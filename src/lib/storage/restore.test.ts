import { afterEach, expect, it, vi } from 'vitest';
import { unzipSync } from 'fflate';
import { decodeCanonical } from '../../../shared/codec';
import { initializeStorage, readFullRecord, resetStorage } from './runtime';
import { appendHit as append, createAccount as create, updateExtensions, updateProfile } from './commands';
import { completed, getGeneration, openDatabase, readBlob, readCurrent, request, transaction } from './idb';
import { getDeviceId } from './commit';
import { accountPath } from './files';
import { garbageCollect, readRecoveryRecord, readRecoverySnapshot, verifyHealthyGeneration } from './recovery';
import { restoreRecoveryGeneration } from './restore';
import { getStorageState } from './snapshot';
import { createRecoveryArchive } from '../data/archive';
import type { BlobRecord, Chunk, Current, Generation, Manifest } from './state-model';

// Global setup uses a fresh fake-indexeddb factory and genuine Node WebCrypto per case.
afterEach(() => { vi.restoreAllMocks(); });
const decode = <T>(bytes: Uint8Array): T => decodeCanonical(bytes) as T;
const save = async (operation: (tx: IDBTransaction) => void): Promise<void> => {
  const tx = transaction(await openDatabase(), 'readwrite'), done = completed(tx);
  operation(tx); await done;
};
const all = async <T>(store: string): Promise<T[]> => {
  const tx = transaction(await openDatabase(), 'readonly'), done = completed(tx);
  const values = await request<T[]>(tx.objectStore(store).getAll()); await done; return values;
};
const damage = async (generation: Generation, path = 'manifest.json'): Promise<Uint8Array> => {
  const blob = await readBlob(generation.map[path]);
  const bytes = new Uint8Array([0xff, 0x00, 0xc3, 0x28]);
  await save(tx => { tx.objectStore('blobs').put({ ...blob, bytes }, blob.id); });
  return bytes;
};
const fixture = async () => {
  const id = (await create('restorer', { email: 'keep@example.test' })).accountId!;
  await updateExtensions(id, { unknown: [null, ['雪'], 7], presence: { missing: false } });
  await append(id, { id: 'old', at: Date.UTC(2026, 10, 1), schemaVersion: 1, recordVersion: '99999999999999999999', extras: [null, { preserved: true }] });
  const old = await getGeneration((await readCurrent())!.generation);
  const record = await readFullRecord(id);
  await append(id, { id: 'newer', at: Date.UTC(2026, 10, 2), schemaVersion: 1, recordVersion: '1' });
  const current = await getGeneration((await readCurrent())!.generation);
  return { id, old, current, record, deviceId: await getDeviceId() };
};

it('exposes verified older full data read-only while damaged current blocks login and mutation', async () => {
  const { id, old, current, record } = await fixture();
  await damage(current);
  await resetStorage();
  await expect(initializeStorage()).rejects.toThrow();
  expect(getStorageState().status).toBe('blocked');
  const pointer = await readCurrent();
  const snapshot = await readRecoverySnapshot();
  expect(snapshot.readOnly).toBe(true);
  expect(snapshot.readableTree).toMatchObject({ generation: old.id, current: false, accounts: [{ accountId: id, handle: 'restorer', total: 1 }] });
  expect(await readRecoveryRecord(old.id, id)).toEqual(record);
  await expect(create('forbidden')).rejects.toMatchObject({ code: 'blocked' });
  await expect(append(id, { id: 'forbidden', at: 1, schemaVersion: 1, recordVersion: '1' })).rejects.toMatchObject({ code: 'blocked' });
  expect(await readCurrent()).toEqual(pointer);
});

it('confirmed recovery commits a new verified generation without version/device rewind or evidence deletion', async () => {
  const { id, old, current, record, deviceId } = await fixture();
  const original = await damage(current);
  const pointer = (await readCurrent())!;
  const beforeVersions = (await all<BlobRecord>('blobs')).map(blob => BigInt(blob.fileVersion));
  const receipt = await restoreRecoveryGeneration(old.id, true, pointer);
  expect(BigInt(receipt.revision)).toBeGreaterThan(BigInt(current.revision));
  const restored = await getGeneration(receipt.generation);
  expect(restored.id).not.toBe(old.id);
  expect(restored.parent).toBe(current.id);
  await expect(verifyHealthyGeneration(restored)).resolves.toBeUndefined();
  expect(await getDeviceId()).toBe(deviceId);
  const manifest = decode<Manifest>((await readBlob(restored.map['manifest.json'])).bytes);
  expect(manifest.deviceId).toBe(deviceId);
  for (const descriptor of manifest.files) {
    for (const version of beforeVersions) expect(BigInt(descriptor.fileVersion)).toBeGreaterThan(version);
  }
  const full = await readFullRecord(id);
  expect(full).toEqual(record);
  expect(full.hits[0].recordVersion).toBe('99999999999999999999');
  expect((await getGeneration(current.id))).toEqual(current);
  expect(Array.from((await readBlob(current.map['manifest.json'])).bytes)).toEqual(Array.from(original));
  // Several healthy successors must not age damaged evidence out of the two-previous window.
  for (let sequence = 0; sequence < 4; sequence++) await updateProfile(id, { note: String(sequence) });
  await garbageCollect();
  expect(await getGeneration(current.id)).toEqual(current);
  expect(Array.from((await readBlob(current.map['manifest.json'])).bytes)).toEqual(Array.from(original));
  expect((await all<Generation>('generations')).some(generation => generation.state === 'quarantined' && generation.parent === current.id)).toBe(true);
});

it('requires explicit confirmation and rejects stale preview consent without publishing', async () => {
  const { id, old } = await fixture();
  const preview = (await readCurrent())!;
  await expect(restoreRecoveryGeneration(old.id, false, preview)).rejects.toMatchObject({ code: 'recovery-confirmation' });
  await append(id, { id: 'concurrent', at: Date.UTC(2026, 10, 3), schemaVersion: 1, recordVersion: '1' });
  const latest = await readCurrent();
  await expect(restoreRecoveryGeneration(old.id, true, preview)).rejects.toMatchObject({ code: 'recovery-stale' });
  expect(await readCurrent()).toEqual(latest);
  expect((await readFullRecord(id)).hits.map(hit => hit.id)).toEqual(['old', 'newer', 'concurrent']);
});

it('failed recovery staging never changes current or deletes the damaged original bytes', async () => {
  const { old, current } = await fixture();
  const bytes = await damage(current), pointer = await readCurrent();
  const prototype = Object.getPrototypeOf((await openDatabase()).transaction(['blobs'], 'readonly').objectStore('blobs')) as IDBObjectStore;
  const add = prototype.add;
  vi.spyOn(prototype, 'add').mockImplementation(function (this: IDBObjectStore, value: unknown, key?: IDBValidKey) {
    if (this.name === 'blobs') throw new DOMException('Injected quota refusal', 'QuotaExceededError');
    return add.call(this, value, key);
  });
  await expect(restoreRecoveryGeneration(old.id, true, pointer)).rejects.toThrow('Injected quota refusal');
  expect(await readCurrent()).toEqual(pointer);
  expect(await getGeneration(current.id)).toEqual(current);
  expect(Array.from((await readBlob(current.map['manifest.json'])).bytes)).toEqual(Array.from(bytes));
});

it('no healthy generation remains blocked but produces a recovery-kind ZIP of accessible exact originals', async () => {
  const id = (await create('only')).accountId!;
  const generation = await getGeneration((await readCurrent())!.generation);
  const damaged = await damage(generation);
  await resetStorage();
  await expect(initializeStorage()).rejects.toThrow();
  const snapshot = await readRecoverySnapshot();
  expect(snapshot.readableTree).toBeNull();
  expect(snapshot.readableGeneration).toBeNull();
  const archive = unzipSync(await createRecoveryArchive(snapshot));
  const manifest = decode<Manifest>(archive['manifest.json']);
  expect(manifest.kind).toBe('recovery');
  const metadata = decodeCanonical(archive['shared/export-metadata.json']) as { files: { originalPath: string; recoveryPath: string }[] };
  const path = metadata.files.find(file => file.originalPath === 'manifest.json')!.recoveryPath;
  expect(Array.from(archive[path])).toEqual(Array.from(damaged));
  expect(snapshot.files.some(file => file.path === `${accountPath(id)}/account.json`)).toBe(true);
  expect(getStorageState().status).toBe('blocked');
  expect((await readCurrent())!.generation).toBe(generation.id);
});

it('corrupt newly requested history blocks subsequent writes without publishing an empty replacement', async () => {
  const { id, current } = await fixture();
  const path = Object.keys(current.map).find(name => /\/run\/y/.test(name))!;
  await damage(current, path);
  const pointer: Current | null = await readCurrent();
  await expect(readFullRecord(id)).rejects.toThrow();
  expect(getStorageState().status).toBe('blocked');
  await expect(create('not-empty')).rejects.toMatchObject({ code: 'blocked' });
  expect(await readCurrent()).toEqual(pointer);
});

it('rechecks the older tree and refuses a now-corrupted source at confirmation', async () => {
  const { old, current } = await fixture();
  await damage(current);
  const preview = await readRecoverySnapshot();
  expect(preview.readableGeneration).toBe(old.id);
  const chunkPath = Object.keys(old.map).find(path => /\/run\/y/.test(path))!;
  const chunk = decode<Chunk>((await readBlob(old.map[chunkPath])).bytes);
  expect(chunk.entries).toHaveLength(1);
  await damage(old, chunkPath);
  const pointer = await readCurrent();
  await expect(restoreRecoveryGeneration(old.id, true, pointer)).rejects.toThrow();
  expect(await readCurrent()).toEqual(pointer);
});
