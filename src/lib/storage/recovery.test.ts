import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { webcrypto } from 'node:crypto';
import { IDBFactory } from 'fake-indexeddb';
import { decodeCanonical } from '../../../shared/codec';
import { appendChunk, emptyIndex } from './chunks';
import { buildCandidate, publishCandidate } from './commit';
import { accountPath, makeBlob, readFile, validatePath } from './files';
import { closeDatabase, completed, getGeneration, openDatabase, readCurrent, request, transaction } from './idb';
import { garbageCollect, readRecoverySnapshot, verifyHealthyGeneration } from './recovery';
import type { BlobRecord, Chunk, Current, Envelope, Generation, Pin, RunIndex } from './state-model';

const ACCOUNT = '11111111-1111-4111-8111-111111111111';
const DEVICE = '22222222-2222-4222-8222-222222222222';
const ROOT = accountPath(ACCOUNT);
const originalCrypto = Object.getOwnPropertyDescriptor(globalThis, 'crypto');
const originalIDB = Object.getOwnPropertyDescriptor(globalThis, 'indexedDB');
const install = (key: string, value: unknown): void => { Object.defineProperty(globalThis, key, { configurable: true, value, writable: true }); };
const object = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value);
const envelope = <T>(payload: T, revision: string): Envelope<T> => ({ accountId: ACCOUNT, schemaVersion: 1, recordVersion: revision, createdAt: 1, updatedAt: 1, payload });

beforeAll(() => { install('crypto', webcrypto); });
beforeEach(async () => { await closeDatabase(); install('indexedDB', new IDBFactory()); });
afterEach(async () => { await closeDatabase(); });
afterAll(() => {
  if (originalCrypto) Object.defineProperty(globalThis, 'crypto', originalCrypto); else Reflect.deleteProperty(globalThis, 'crypto');
  if (originalIDB) Object.defineProperty(globalThis, 'indexedDB', originalIDB); else Reflect.deleteProperty(globalThis, 'indexedDB');
});

const save = async (operation: (tx: IDBTransaction) => void): Promise<void> => {
  const tx = transaction(await openDatabase(), 'readwrite'), done = completed(tx);
  operation(tx);
  await done;
};
const records = async <T>(store: string): Promise<T[]> => {
  const tx = transaction(await openDatabase(), 'readonly'), done = completed(tx);
  const result = await request<T[]>(tx.objectStore(store).getAll());
  await done;
  return result;
};
const fixture = async (hits: { id: string; at: number; [key: string]: unknown }[] = [], base: Generation | null = null): Promise<Generation> => {
  const revision = String(BigInt(base?.revision ?? '0') + 1n);
  const changes = new Map<string, BlobRecord | null>();
  let index = emptyIndex(ACCOUNT, revision);
  const chunks = new Map<string, Chunk>();
  for (const input of hits) {
    const hit = { schemaVersion: 1 as const, recordVersion: '1', ...input };
    const month = new Date(hit.at).getUTCMonth();
    const tail = [...chunks.values()].filter(chunk => new Date(chunk.entries[0].hit.at).getUTCMonth() === month).at(-1) ?? null;
    const result = await appendChunk(ACCOUNT, index, hit, tail, revision);
    changes.set(result.path, result.blob);
    const decoded: unknown = decodeCanonical(result.blob.bytes);
    if (!object(decoded) || decoded.accountId !== ACCOUNT || decoded.schemaVersion !== 1 || typeof decoded.recordVersion !== 'string' || typeof decoded.createdAt !== 'number' || typeof decoded.updatedAt !== 'number' || typeof decoded.partition !== 'string' || typeof decoded.sequence !== 'number' || !Array.isArray(decoded.entries)) throw new Error('Fixture chunk failed to decode.');
    const entries = [...(tail?.entries ?? []), { ordinal: index.nextOrdinal, hit }];
    chunks.set(result.path, { accountId: ACCOUNT, schemaVersion: 1, recordVersion: decoded.recordVersion, createdAt: decoded.createdAt, updatedAt: decoded.updatedAt, partition: decoded.partition, sequence: decoded.sequence, entries });
    index = result.index;
  }
  const files: [string, unknown][] = [
    ['shared/accounts.json', { schemaVersion: 1, recordVersion: revision, accounts: [{ accountId: ACCOUNT, handle: 'reader', registeredAt: 1 }] }],
    ['shared/extensions.json', { unknown: ['原始', null, 17] }], ['shared/export-metadata.json', {}],
    ['device/preferences.json', { timezone: 'UTC', appearance: 'light', language: 'en-US', calendarTheme: 'github-green', mode: 'local' }],
    [`${ROOT}/account.json`, envelope({ handle: 'reader', registeredAt: 1, extensions: {} }, revision)],
    [`${ROOT}/profile.json`, envelope({ fields: {}, emailVerification: 'unverified' }, revision)], [`${ROOT}/settings.json`, envelope({}, revision)],
    [`${ROOT}/extensions.json`, envelope([null, 'kept'], revision)],
    [`${ROOT}/plugins/games.json`, { ...envelope({ settings: {}, cardCollections: {} }, revision), pluginId: 'games' }],
    [`${ROOT}/imports/index.json`, envelope([], revision)], [`${ROOT}/run/index.json`, index],
  ];
  if (base) for (const path of Object.keys(base.map)) if (path.includes('/run/y') && !changes.has(path)) changes.set(path, null);
  for (const [path, value] of files) changes.set(path, await makeBlob(value, revision));
  const candidate = await buildCandidate(base, changes, DEVICE);
  await publishCandidate(candidate);
  return getGeneration(candidate.generation.id);
};
const rewrite = async (base: Generation, path: string, value: unknown): Promise<Generation> => {
  const revision = String(BigInt(base.revision) + 1n);
  const candidate = await buildCandidate(base, new Map([[path, await makeBlob(value, revision)]]), DEVICE);
  // Simulate rehashed damage after publication, never bypass production staging validation.
  const forged = { ...candidate.generation, state: 'committed' as const };
  await save(tx => {
    for (const blob of candidate.blobs.values()) tx.objectStore('blobs').put(blob, blob.id);
    tx.objectStore('generations').put(forged, forged.id);
    tx.objectStore('control').put({ generation: forged.id, revision: forged.revision, manifestDigest: forged.manifestDigest }, 'current');
  });
  return forged;
};
const corrupt = async (generation: Generation, path: string): Promise<Uint8Array> => {
  const all = await records<BlobRecord>('blobs');
  const blob = all.find(value => value.id === generation.map[path])!;
  const bytes = new Uint8Array([0xff, 0x00, 0x7b, 0xc3]);
  await save(tx => { tx.objectStore('blobs').put({ ...blob, bytes }, blob.id); });
  return bytes;
};

describe('full committed-generation recovery audit', () => {
  it('verifies hashes, ownership, unsorted timestamp ties, all chunks and exact index projection', async () => {
    const generation = await fixture([
      { id: 'late-first', at: Date.UTC(2026, 10, 3), extra: { text: '雪', untouched: [null, 0] } },
      { id: 'earlier-second', at: Date.UTC(2026, 9, 1) },
      { id: 'same-time', at: Date.UTC(2026, 10, 3) },
      { id: 'backdated-tail', at: Date.UTC(2026, 10, 1) },
    ]);
    await expect(verifyHealthyGeneration(generation)).resolves.toBeUndefined();
    const snapshot = await readRecoverySnapshot();
    expect(snapshot.readableGeneration).toBe(generation.id);
    expect(snapshot.readOnly).toBe(true);
    expect(snapshot.diagnostics).toEqual([]);
    expect(snapshot.files).toHaveLength(Object.keys(generation.map).length);
    expect(Array.from(snapshot.files.find(file => file.path === 'shared/extensions.json')!.bytes)).toEqual(Array.from((await records<BlobRecord>('blobs')).find(blob => blob.id === generation.map['shared/extensions.json'])!.bytes));
  });

  it('labels the previous verified tree without promoting it and rescues corrupt original bytes', async () => {
    const old = await fixture([{ id: 'saved', at: Date.UTC(2026, 10, 1) }]);
    const current = await fixture([{ id: 'saved', at: Date.UTC(2026, 10, 1) }, { id: 'newer', at: Date.UTC(2026, 10, 2) }], old);
    const index = await readFile<RunIndex>(current, `${ROOT}/run/index.json`);
    const damagedPath = index.chunks[0].path;
    const bytes = await corrupt(current, damagedPath);
    const pointer = await readCurrent();
    const snapshot = await readRecoverySnapshot();
    expect(snapshot.current).toEqual(pointer);
    expect(snapshot.readOnly).toBe(true);
    expect(snapshot.readableGeneration).toBe(old.id);
    expect(snapshot.diagnostics.some(item => item.code === 'previous-generation' && item.message.includes('Read-only previous generation'))).toBe(true);
    expect(Array.from(snapshot.files.find(file => file.path === damagedPath)!.bytes)).toEqual(Array.from(bytes));
    const previousBlob = (await records<BlobRecord>('blobs')).find(blob => blob.id === old.map[damagedPath])!;
    expect(Array.from(snapshot.files.find(file => file.path === `recovery/${previousBlob.id}.bin`)!.bytes)).toEqual(Array.from(previousBlob.bytes));
    expect(new Set(snapshot.files.map(file => file.path)).size).toBe(snapshot.files.length);
    snapshot.files.forEach(file => expect(() => validatePath(file.path)).not.toThrow());
    expect(await readCurrent()).toEqual(pointer);
    expect((await getGeneration(current.id)).state).toBe('committed');
  });

  it('rejects a correctly rehashed but semantically false timestamp projection', async () => {
    const base = await fixture([{ id: 'one', at: Date.UTC(2026, 10, 1) }]);
    const index = await readFile<RunIndex>(base, `${ROOT}/run/index.json`);
    const forged = await rewrite(base, `${ROOT}/run/index.json`, { ...index, sourceRevision: '2', timestamps: [{ ...index.timestamps[0], at: index.timestamps[0].at + 1 }] });
    await expect(verifyHealthyGeneration(forged)).rejects.toThrow('exact authoritative chunk projection');
    const snapshot = await readRecoverySnapshot();
    expect(snapshot.readableGeneration).toBe(base.id);
    expect(snapshot.current?.generation).toBe(forged.id);
  });

  it('rejects cross-chunk duplicate hit ids even when every digest and projection agrees', async () => {
    const generation = await fixture([{ id: 'duplicate', at: Date.UTC(2026, 9, 1) }, { id: 'originally-unique', at: Date.UTC(2026, 10, 1) }]);
    const index = await readFile<RunIndex>(generation, `${ROOT}/run/index.json`);
    const descriptor = index.chunks[1];
    const chunk = await readFile<Chunk>(generation, descriptor.path);
    chunk.entries[0].hit.id = 'duplicate';
    const blob = await makeBlob(chunk, generation.revision);
    const manifest = await readFile<import('./state-model').Manifest>(generation, 'manifest.json');
    manifest.files = manifest.files.map(file => file.path === descriptor.path ? { ...file, bytes: blob.length, sha256: blob.sha256 } : file);
    index.chunks[1] = { ...descriptor, bytes: blob.length, sha256: blob.sha256 };
    index.hitIds[1] = 'duplicate';
    const indexBlob = await makeBlob(index, generation.revision);
    manifest.files = manifest.files.map(file => file.path === `${ROOT}/run/index.json` ? { ...file, bytes: indexBlob.length, sha256: indexBlob.sha256 } : file);
    const manifestBlob = await makeBlob(manifest, generation.revision);
    const forged = { ...generation, manifestDigest: manifestBlob.sha256, map: { ...generation.map, [descriptor.path]: blob.id, [`${ROOT}/run/index.json`]: indexBlob.id, 'manifest.json': manifestBlob.id } };
    await save(tx => {
      for (const value of [blob, indexBlob, manifestBlob]) tx.objectStore('blobs').put(value, value.id);
      tx.objectStore('generations').put(forged, forged.id);
      tx.objectStore('control').put({ generation: forged.id, revision: forged.revision, manifestDigest: forged.manifestDigest }, 'current');
    });
    await expect(verifyHealthyGeneration(forged)).rejects.toThrow('Duplicate hit identity or invalid run index hit ids in ordinal order.');
  });

  it('rejects self-consistent rehashed metadata corrupted after publication with the wrong ownership', async () => {
    const generation = await fixture();
    const path = `${ROOT}/profile.json`;
    const profile = await makeBlob({ ...envelope({ fields: {}, emailVerification: 'unverified' }, '1'), accountId: DEVICE }, '1');
    const manifest = await readFile<import('./state-model').Manifest>(generation, 'manifest.json');
    manifest.files = manifest.files.map(file => file.path === path ? { ...file, bytes: profile.length, sha256: profile.sha256 } : file);
    const manifestBlob = await makeBlob(manifest, '1');
    const forged = { ...generation, manifestDigest: manifestBlob.sha256, map: { ...generation.map, [path]: profile.id, 'manifest.json': manifestBlob.id } };
    await save(tx => {
      tx.objectStore('blobs').put(profile, profile.id);
      tx.objectStore('blobs').put(manifestBlob, manifestBlob.id);
      tx.objectStore('generations').put(forged, forged.id);
      tx.objectStore('control').put({ generation: forged.id, revision: forged.revision, manifestDigest: forged.manifestDigest }, 'current');
    });
    await expect(verifyHealthyGeneration(forged)).rejects.toThrow('Invalid canonical account envelope or ownership.');
  });

  it('remains read-only with no healthy generation and preserves staged/quarantined raw evidence', async () => {
    const current = await fixture();
    const damaged = await corrupt(current, 'manifest.json');
    const raw = await makeBlob({ evidence: ['keep', null] }, '1');
    const quarantined: Generation = { ...current, id: 'quarantined-evidence', state: 'quarantined', map: { 'invalid/original-path': raw.id } };
    const staged: Generation = { ...quarantined, id: 'staged-evidence', state: 'staged' };
    await save(tx => {
      tx.objectStore('blobs').put(raw, raw.id);
      tx.objectStore('generations').put(quarantined, quarantined.id);
      tx.objectStore('generations').put(staged, staged.id);
    });
    const snapshot = await readRecoverySnapshot();
    expect(snapshot.readableGeneration).toBeNull();
    expect(snapshot.diagnostics.some(item => item.code === 'no-readable-generation')).toBe(true);
    expect(Array.from(snapshot.files.find(file => file.path === 'manifest.json')!.bytes)).toEqual(Array.from(damaged));
    expect(Array.from(snapshot.files.find(file => file.path === `recovery/${raw.id}.bin`)!.bytes)).toEqual(Array.from(raw.bytes));
    expect(await readCurrent()).toMatchObject({ generation: current.id });
  });

  it('diagnoses missing references while returning other accessible exact bytes', async () => {
    const generation = await fixture();
    const missing = generation.map[`${ROOT}/profile.json`];
    await save(tx => { tx.objectStore('blobs').delete(missing); });
    const snapshot = await readRecoverySnapshot();
    expect(snapshot.readableGeneration).toBeNull();
    expect(snapshot.diagnostics.some(item => item.code === 'inaccessible-blob' && item.message.includes(missing))).toBe(true);
    expect(snapshot.files).toHaveLength(Object.keys(generation.map).length - 1);
  });

  it('rescues accessible blobs despite a damaged generation map entry', async () => {
    const generation = await fixture();
    await save(tx => { tx.objectStore('generations').put({ ...generation, map: { ...generation.map, 'broken/reference': null } }, generation.id); });
    const snapshot = await readRecoverySnapshot();
    expect(snapshot.readableGeneration).toBeNull();
    expect(snapshot.files.some(file => file.path === 'manifest.json')).toBe(true);
    expect(snapshot.files).toHaveLength(Object.keys(generation.map).length);
    await expect(garbageCollect()).rejects.toThrow('malformed generation evidence');
    expect((await records<BlobRecord>('blobs')).length).toBe(Object.keys(generation.map).length);
  });

  it('preserves both original paths when a generation aliases immutable raw bytes', async () => {
    const generation = await fixture();
    const old = generation.map['shared/export-metadata.json'];
    const shared = generation.map['shared/extensions.json'];
    await save(tx => { tx.objectStore('generations').put({ ...generation, map: { ...generation.map, 'shared/export-metadata.json': shared } }, generation.id); tx.objectStore('blobs').delete(old); });
    const snapshot = await readRecoverySnapshot();
    const extensions = snapshot.files.find(file => file.path === 'shared/extensions.json')!;
    const metadata = snapshot.files.find(file => file.path === 'shared/export-metadata.json')!;
    expect(Array.from(metadata.bytes)).toEqual(Array.from(extensions.bytes));
    expect(snapshot.files).toHaveLength(Object.keys(generation.map).length);
  });

  it('visibly rejects when IndexedDB cannot open instead of fabricating an empty rescue', async () => {
    await closeDatabase();
    install('indexedDB', undefined);
    await expect(readRecoverySnapshot()).rejects.toMatchObject({ code: 'unavailable' });
  });
});

describe('atomic reachability GC after a healthy caller gate', () => {
  const metadata = (id: string, revision: number, blob: BlobRecord, state: Generation['state'] = 'committed', createdAt = Date.now()): Generation => ({ id, revision: String(revision), baseRevision: String(revision - 1), parent: null, state, createdAt, map: { 'shared/extensions.json': blob.id }, manifestDigest: blob.sha256 });

  it('retains current/two predecessors, live readers/base pins, young staging and quarantine; deletes only unreachable evidence', async () => {
    const now = Date.now();
    const blobs = await Promise.all(Array.from({ length: 15 }, (_, index) => makeBlob({ index }, '1')));
    const generations = blobs.slice(0, 8).map((blob, index) => metadata(`g${index + 1}`, index + 1, blob));
    const recent = { ...metadata('recent-stage', 9, blobs[8], 'staged', now - 23 * 60 * 60 * 1000), parent: 'g3' };
    const stale = metadata('expired-stage', 10, blobs[9], 'staged', now - 25 * 60 * 60 * 1000);
    const pinned = { ...metadata('pinned-stage', 11, blobs[10], 'staged', now - 25 * 60 * 60 * 1000), parent: 'g4' };
    const quarantined = metadata('quarantined', 12, blobs[11], 'quarantined', 1);
    generations[7].map['shared/accounts.json'] = blobs[0].id; // Reused blob survives deletion of its old generation.
    const pointer: Current = { generation: 'g8', revision: '8', manifestDigest: generations[7].manifestDigest };
    const pins: Pin[] = [
      { id: 'reader', generation: 'g2', expiresAt: now + 60_000 },
      { id: 'writer', generation: pinned.id, expiresAt: now + 60_000 },
      { id: 'base-pin', generation: 'g5', expiresAt: now + 60_000 },
      { id: 'expired', generation: 'g1', expiresAt: now - 1 },
    ];
    await save(tx => {
      for (const blob of blobs) tx.objectStore('blobs').put(blob, blob.id);
      for (const generation of [...generations, recent, stale, pinned, quarantined]) tx.objectStore('generations').put(generation, generation.id);
      for (const pin of pins) tx.objectStore('pins').put(pin, pin.id);
      tx.objectStore('control').put(pointer, 'current');
    });
    await garbageCollect();
    expect((await records<Generation>('generations')).map(value => value.id).sort()).toEqual(['g2', 'g3', 'g4', 'g5', 'g6', 'g7', 'g8', pinned.id, quarantined.id, recent.id].sort());
    expect((await records<BlobRecord>('blobs')).map(value => value.id).sort()).toEqual([...blobs.slice(0, 9), blobs[10], blobs[11]].map(value => value.id).sort());
    expect((await records<Pin>('pins')).map(value => value.id).sort()).toEqual(['base-pin', 'reader', 'writer']);
    expect(await readCurrent()).toEqual(pointer);
  });

  it('serializes GC behind an already-running writer and sees its new current/pin roots', async () => {
    const blobs = await Promise.all(Array.from({ length: 5 }, (_, index) => makeBlob({ index }, '1')));
    const generations = blobs.map((blob, index) => metadata(`serialized-${index + 1}`, index + 1, blob));
    await save(tx => {
      for (const blob of blobs) tx.objectStore('blobs').put(blob, blob.id);
      for (const generation of generations.slice(0, 4)) tx.objectStore('generations').put(generation, generation.id);
      tx.objectStore('control').put({ generation: generations[3].id, revision: '4', manifestDigest: generations[3].manifestDigest }, 'current');
    });
    const writer = transaction(await openDatabase(), 'readwrite'), written = completed(writer);
    writer.objectStore('generations').put(generations[4], generations[4].id);
    writer.objectStore('control').put({ generation: generations[4].id, revision: '5', manifestDigest: generations[4].manifestDigest }, 'current');
    writer.objectStore('pins').put({ id: 'concurrent-reader', generation: generations[0].id, expiresAt: Date.now() + 60_000 }, 'concurrent-reader');
    await Promise.all([written, garbageCollect()]);
    expect((await records<Generation>('generations')).map(value => value.id).sort()).toEqual([generations[0], ...generations.slice(2)].map(value => value.id).sort());
    expect((await records<BlobRecord>('blobs')).map(value => value.id).sort()).toEqual([blobs[0], ...blobs.slice(2)].map(value => value.id).sort());
    expect(await readCurrent()).toMatchObject({ generation: generations[4].id, revision: '5' });
  });

  it('keeps generation zero without inventing predecessors', async () => {
    const zero = await fixture();
    const before = await records<BlobRecord>('blobs');
    await garbageCollect();
    expect(await records<Generation>('generations')).toEqual([zero]);
    expect(await records<BlobRecord>('blobs')).toEqual(before);
  });

  it('does not collect on absent or inconsistent current and atomically rolls back failed GC', async () => {
    const blob = await makeBlob({ evidence: true }, '1');
    const generation = metadata('stranded', 1, blob, 'staged', 1);
    await save(tx => { tx.objectStore('generations').put(generation, generation.id); tx.objectStore('blobs').put(blob, blob.id); });
    await garbageCollect();
    expect(await records<BlobRecord>('blobs')).toEqual([blob]);
    await save(tx => { tx.objectStore('control').put({ generation: 'missing', revision: '7', manifestDigest: 'invalid' }, 'current'); });
    await expect(garbageCollect()).rejects.toThrow('GC refused');
    expect(await records<Generation>('generations')).toEqual([generation]);
    expect(await records<BlobRecord>('blobs')).toEqual([blob]);
  });
});
