import { describe, expect, it, vi } from 'vitest';
import { appendHit, createAccount, ensureRunView, getAccountSnapshot, getRunView, initializeStorage, readFullRecord, readRecord, renameAccount, resetStorage, updatePlugin, updateProfile } from './index';
import { completed, getGeneration, openDatabase, readCurrent, request, transaction } from './idb';
import { buildCandidate, commitPrepared, prepare, verifyPrepared } from './commit';
import { accountPath, makeBlob, readFile } from './files';
import { appendChunk, emptyIndex, utcPartition } from './chunks';
import { getPreferencesSnapshot, setCalendarTheme } from './preferences';
import type { BlobRecord, Manifest } from './state-model';
import { createExportDocument } from '../data/transfer';
import { unzipSync } from 'fflate';

const create = async (handle = 'alice') => {
  const receipt = await createAccount(handle);
  if (!receipt.accountId) throw new Error('Missing account receipt.');
  return receipt.accountId;
};
const generation = async () => {
  const current = await readCurrent();
  if (!current) throw new Error('Missing current.');
  return getGeneration(current.generation);
};
describe('virtual-file core', () => {
  it('keeps empty first boot volatile, ignores obsolete bytes, and commits generation zero only on login', async () => {
    localStorage.setItem('runawaylog-data', '{obsolete broken');
    localStorage.setItem('calendar-theme', 'obsolete');
    const reads = vi.spyOn(Storage.prototype, 'getItem');
    expect(await readCurrent()).toBeNull();
    await setCalendarTheme('fresh-choice');
    expect(await readCurrent()).toBeNull();
    const id = await create();
    expect((await generation()).id).toMatch(/^0-/);
    expect(getAccountSnapshot(id)?.total).toBe(0);
    expect(Object.keys((await generation()).map).filter(path => /\/run\/y/.test(path))).toHaveLength(0);
    expect(getPreferencesSnapshot().calendarTheme).toBe('fresh-choice');
    expect(reads.mock.calls.some(([key]) => ['runawaylog-data', 'calendar-theme'].includes(key))).toBe(false);
    reads.mockRestore();
    expect(localStorage.getItem('runawaylog-data')).toBe('{obsolete broken');
  });
  it('reuses unrelated blobs and changes only one chunk, own index and manifest on Run', async () => {
    const a = await create();
    const b = await create('bob');
    await appendHit(a, { id: 'first', at: 0, schemaVersion: 1, recordVersion: '1', extras: ['é', null] });
    const before = await generation();
    await appendHit(a, { id: 'second', at: 1, schemaVersion: 1, recordVersion: '1' });
    const after = await generation();
    const changed = Object.keys(after.map).filter(path => before.map[path] !== after.map[path]);
    expect(changed.sort()).toEqual(['manifest.json', `${accountPath(a)}/run/index.json`, `${accountPath(a)}/run/y1970-m01-000001.json`].sort());
    expect(Object.keys(before.map).filter(path => path.startsWith(accountPath(b))).every(path => before.map[path] === after.map[path])).toBe(true);
    expect((await readFullRecord(a)).hits).toEqual([{ id: 'first', at: 0, schemaVersion: 1, recordVersion: '1', extras: ['é', null] }, { id: 'second', at: 1, schemaVersion: 1, recordVersion: '1' }]);
  });
  it('preserves identity, registration and device provenance across rename and reload', async () => {
    const id = await create('name/with-path');
    const first = await generation();
    const manifest = await readFile<Manifest>(first, 'manifest.json');
    const registeredAt = getAccountSnapshot(id)?.registeredAt;
    await appendHit(id, { id: 'keep', at: 0, schemaVersion: 1, recordVersion: '1' });
    await renameAccount(id, 'renamed');
    await resetStorage();
    await initializeStorage();
    expect(await readRecord('name/with-path')).toBeNull();
    expect(await readRecord('renamed')).toMatchObject({ accountId: id, registeredAt, total: 1 });
    expect((await readFile<Manifest>(await generation(), 'manifest.json')).deviceId).toBe(manifest.deviceId);
  });
  it('projects exact timestamps and recent fifty without statistics fetching history chunks', async () => {
    const id = await create();
    for (let index = 0; index < 53; index++) await appendHit(id, { id: String(index), at: index % 3, schemaVersion: 1, recordVersion: '1' });
    const snapshot = getAccountSnapshot(id)!;
    expect(snapshot.index.timestamps).toEqual([{ at: 0, count: 18, firstOrdinal: 0 }, { at: 1, count: 18, firstOrdinal: 1 }, { at: 2, count: 17, firstOrdinal: 2 }]);
    expect(snapshot).not.toHaveProperty('hits');
    const db = await openDatabase();
    const real = db.transaction.bind(db);
    const spy = vi.spyOn(db, 'transaction');
    spy.mockImplementation(real);
    const callsBefore = spy.mock.calls.length;
    expect(getAccountSnapshot(id)?.index.total).toBe(53);
    expect(spy.mock.calls).toHaveLength(callsBefore);
    await ensureRunView(id, 'UTC', '1970-01');
    expect(getRunView(id, 'UTC', '1970-01')?.recentHits).toHaveLength(50);
    expect(getRunView(id, 'UTC', '1970-01')?.dayCounts).toEqual({ '1970-01-01': 53 });
    spy.mockRestore();
  });
  it('rejects oversized and unsupported values with unchanged pointer and permits safe retries', async () => {
    const id = await create();
    const before = await readCurrent();
    await expect(appendHit(id, { id: 'oversized', at: 0, schemaVersion: 1, recordVersion: '1', value: 'é'.repeat(500_000) })).rejects.toThrow();
    expect(await readCurrent()).toEqual(before);
    await expect(updateProfile(id, { invalid: undefined })).rejects.toThrow();
    expect(await readCurrent()).toEqual(before);
    await appendHit(id, { id: 'valid', at: 0, schemaVersion: 1, recordVersion: '1' });
    expect(getAccountSnapshot(id)?.total).toBe(1);
  });
  it('keeps plugin patches atomic and monotonic file versions while sharing history', async () => {
    const id = await create();
    await appendHit(id, { id: 'keep', at: 0, schemaVersion: 1, recordVersion: '1' });
    const before = await generation();
    await updatePlugin(id, { settings: { cardDropEnabled: true, opaque: [null, 1] }, cardCollections: { '#001': 3 } });
    const after = await generation();
    expect(before.map[`${accountPath(id)}/run/y1970-m01-000001.json`]).toBe(after.map[`${accountPath(id)}/run/y1970-m01-000001.json`]);
    const oldManifest = await readFile<Manifest>(before, 'manifest.json');
    const newManifest = await readFile<Manifest>(after, 'manifest.json');
    const path = `${accountPath(id)}/plugins/games.json`;
    expect(BigInt(newManifest.files.find(file => file.path === path)!.fileVersion)).toBeGreaterThan(BigInt(oldManifest.files.find(file => file.path === path)!.fileVersion));
    expect((await readFullRecord(id)).settings?.games).toEqual({ cardDropEnabled: true, opaque: [null, 1] });
  });
  it('prepares and reads back without publication; stale CAS aborts and preserves complete current', async () => {
    await create();
    const base = await generation();
    const manifest = await readFile<Manifest>(base, 'manifest.json');
    const first = await buildCandidate(base, new Map([['shared/extensions.json', await makeBlob({ writer: 1 }, '2')]]), manifest.deviceId);
    const second = await buildCandidate(base, new Map([['shared/extensions.json', await makeBlob({ writer: 2 }, '2')]]), manifest.deviceId);
    await prepare(first); await verifyPrepared(first);
    expect((await readCurrent())?.generation).toBe(base.id);
    await prepare(second); await verifyPrepared(second);
    await commitPrepared(first);
    await expect(commitPrepared(second)).rejects.toMatchObject({ code: 'conflict' });
    expect((await readCurrent())?.generation).toBe(first.generation.id);
  });
  it('quarantines corrupt staged bytes and never changes current', async () => {
    await create();
    const base = await generation();
    const manifest = await readFile<Manifest>(base, 'manifest.json');
    const candidate = await buildCandidate(base, new Map([['shared/extensions.json', await makeBlob({ preserve: true }, '2')]]), manifest.deviceId);
    await prepare(candidate);
    const db = await openDatabase();
    const tx = transaction(db, 'readwrite');
    const done = completed(tx);
    const blob = await request<BlobRecord>(tx.objectStore('blobs').get(candidate.generation.map['shared/extensions.json']));
    tx.objectStore('blobs').put({ ...blob, bytes: new Uint8Array([1]) }, blob.id);
    await done;
    await expect(verifyPrepared(candidate)).rejects.toThrow();
    expect((await getGeneration(candidate.generation.id)).state).toBe('quarantined');
    expect((await readCurrent())?.generation).toBe(base.id);
  });
  it('exports the latest pinned selected account without another account or credentials', async () => {
    const alice = await create();
    const bob = await create('bob');
    await appendHit(alice, { id: 'latest', at: 0, schemaVersion: 1, recordVersion: '1', scalar: null });
    await appendHit(bob, { id: 'secret-bob', at: 1, schemaVersion: 1, recordVersion: '1' });
    const zip = await createExportDocument({ username: 'alice' });
    const files = unzipSync(zip);
    expect(Object.keys(files)[0]).toBe('manifest.json');
    expect(Object.keys(files).some(path => path.includes(bob))).toBe(false);
    expect(Object.keys(files).some(path => path.includes(alice))).toBe(true);
    expect(new TextDecoder().decode(zip)).not.toContain('credentials');
  });
});
describe('chunk boundaries', () => {
  it('supports UTC partitions at the full valid Date limits and negative years', () => {
    expect(utcPartition(-8_640_000_000_000_000)).toMatch(/^yn[0-9]{4,}-m[0-9]{2}$/);
    expect(utcPartition(8_640_000_000_000_000)).toBe('y275760-m09');
    expect(utcPartition(Date.parse('0000-01-01T00:00:00Z'))).toBe('y0000-m01');
    expect(() => utcPartition(8_640_000_000_000_001)).toThrow();
  });
  it('allows count equality, rolls next hit, and appends backdated months without touching completed chunks', async () => {
    const id = crypto.randomUUID();
    const index = emptyIndex(id, '1');
    const now = 0;
    const entries = Array.from({ length: 4999 }, (_, ordinal) => ({ ordinal, hit: { id: String(ordinal), at: now, schemaVersion: 1, recordVersion: '1' } }));
    const tail = { accountId: id, schemaVersion: 1 as const, recordVersion: '1', createdAt: now, updatedAt: now, partition: 'y1970-m01', sequence: 1, entries };
    index.nextOrdinal = index.total = 4999;
    const equal = await appendChunk(id, index, { id: '4999', at: now, schemaVersion: 1, recordVersion: '1' }, tail, '2');
    expect(equal.index.chunks[0].count).toBe(5000);
    const decoded = JSON.parse(new TextDecoder().decode(equal.blob.bytes));
    const rolled = await appendChunk(id, equal.index, { id: '5000', at: now, schemaVersion: 1, recordVersion: '1' }, decoded, '3');
    expect(rolled.path).toContain('-000002.json');
    expect(rolled.index.chunks).toHaveLength(2);
    expect(rolled.index.chunks[0]).toEqual(equal.index.chunks[0]);
  });
});
