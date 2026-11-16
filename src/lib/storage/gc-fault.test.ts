import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { webcrypto } from 'node:crypto';
import { IDBFactory } from 'fake-indexeddb';
import * as api from './index';
import * as idb from './idb';
import { getDeviceId, withPinnedGeneration } from './commit';
import { makeBlob, readFile } from './files';
import { garbageCollect, readRecoverySnapshot, verifyHealthyGeneration } from './recovery';
import type { BlobRecord, Envelope, Generation, Pin } from './state-model';

const secondConnections: (typeof import('./idb'))[] = [];
const cleanups: (() => void)[] = [];
const hit = (id: string, at: number) => ({ id, at, schemaVersion: 1 as const, recordVersion: '1' });
const currentGeneration = async (): Promise<Generation> => {
  const pointer = await idb.readCurrent();
  if (!pointer) throw new Error('Expected a committed current generation.');
  return idb.getGeneration(pointer.generation);
};
const save = async (operation: (tx: IDBTransaction) => void): Promise<void> => {
  const tx = idb.transaction(await idb.openDatabase(), 'readwrite'), done = idb.completed(tx);
  operation(tx);
  await done;
};
const records = async <T>(store: string): Promise<T[]> => {
  const tx = idb.transaction(await idb.openDatabase(), 'readonly'), done = idb.completed(tx);
  const values = await idb.request<T[]>(tx.objectStore(store).getAll());
  await done;
  return values;
};
const databaseSnapshot = async () => ({
  current: await idb.readCurrent(), deviceId: await getDeviceId(),
  generations: await records<Generation>('generations'), blobs: await records<BlobRecord>('blobs'), pins: await records<Pin>('pins'),
});
/** Abort only after an actual fake-IDB delete request succeeds, not instead of deleting. */
const abortAfterDelete = async (store: 'generations' | 'blobs' | 'pins', key?: IDBValidKey) => {
  const db = await idb.openDatabase(), transaction = db.transaction.bind(db);
  const methods: { mockRestore(): void }[] = [];
  let deletesSucceeded = 0;
  const spy = vi.spyOn(db, 'transaction').mockImplementation((...args: Parameters<IDBDatabase['transaction']>) => {
    const tx = transaction(...args);
    if (args[1] === 'readwrite') {
      const objectStore = tx.objectStore(store), remove = objectStore.delete.bind(objectStore);
      methods.push(vi.spyOn(objectStore, 'delete').mockImplementation((...deleteArgs: Parameters<IDBObjectStore['delete']>) => {
        const operation = remove(...deleteArgs);
        if (key === undefined || deleteArgs[0] === key) operation.addEventListener('success', () => { deletesSucceeded++; tx.abort(); }, { once: true });
        return operation;
      }));
    }
    return tx;
  });
  const restore = () => { spy.mockRestore(); methods.forEach(method => method.mockRestore()); };
  cleanups.push(restore);
  return { restore, succeeded: () => deletesSucceeded };
};
const queuedRoots = async () => {
  const receipt = await api.createAccount('gc-live-account', { untouched: [null, '雪'] });
  if (!receipt.accountId) throw new Error('Expected an account UUID.');
  const original = await currentGeneration(), pin = await idb.pinGeneration(original.id);
  const hits = [];
  for (let index = 0; index < 5; index++) {
    const entry = hit(`committed-${index}`, Date.UTC(2026, 10, index + 1));
    hits.push(entry); await api.appendHit(receipt.accountId, entry);
  }
  // Finish maintenance queued by the commands before installing deliberate fault evidence.
  await garbageCollect();
  return { id: receipt.accountId, original, pin, hits, current: await currentGeneration() };
};
const addEvidence = async (original: Generation) => {
  const [raw, orphan, expiredBytes] = await Promise.all([
    makeBlob({ original: ['raw evidence', null, '保留'] }, '1'), makeBlob({ unreachable: 'safe to collect' }, '1'), makeBlob({ expired: 'uncommitted candidate' }, '1'),
  ]);
  // Keep deliberately invalid original bytes, not a JSON parse/reserialize approximation.
  raw.bytes = new Uint8Array([0xff, 0x00, 0xc3, 0x28, 0x7b]); raw.length = raw.bytes.length;
  const quarantine: Generation = { ...original, id: 'aged-quarantined-evidence', parent: original.id, state: 'quarantined', createdAt: 1, map: { 'unregistered/raw-source': raw.id } };
  const expired: Generation = { ...original, id: 'aged-unpinned-stage', state: 'staged', createdAt: 1, parent: null, map: { 'shared/extensions.json': expiredBytes.id } };
  const expiredPin: Pin = { id: 'expired-reader-evidence', generation: original.id, expiresAt: Date.now() - 1 };
  await save(tx => {
    for (const blob of [raw, orphan, expiredBytes]) tx.objectStore('blobs').put(blob, blob.id);
    for (const generation of [quarantine, expired]) tx.objectStore('generations').put(generation, generation.id);
    tx.objectStore('pins').put(expiredPin, expiredPin.id);
  });
  return { raw, orphan, expiredBytes, quarantine, expired, expiredPin };
};

beforeEach(async () => {
  await api.resetStorage();
  vi.stubGlobal('indexedDB', new IDBFactory()); vi.stubGlobal('crypto', webcrypto); vi.stubGlobal('BroadcastChannel', undefined);
  await api.initializeStorage();
});
afterEach(async () => {
  cleanups.splice(0).reverse().forEach(cleanup => cleanup());
  vi.restoreAllMocks();
  await api.resetStorage();
  for (const connection of secondConnections.splice(0)) await connection.closeDatabase();
  // Dynamic maintenance imports may use the last resetModules graph in later tests.
  await (await import('./idb')).closeDatabase();
  vi.unstubAllGlobals();
});

describe('GC transaction faults over real committed command roots', () => {
  it.each(['generations', 'blobs', 'pins'] as const)('rolls back every store when GC aborts after a successful %s delete, preserving roots, leases and exact quarantine bytes', async store => {
    const roots = await queuedRoots(), evidence = await addEvidence(roots.original);
    const before = await databaseSnapshot(), observerSnapshot = api.getStoreSnapshot();
    const fault = await abortAfterDelete(store, store === 'generations' ? evidence.expired.id : store === 'pins' ? evidence.expiredPin.id : undefined);
    try {
      await expect(garbageCollect()).rejects.toThrow();
      expect(fault.succeeded()).toBe(1);
      expect(await databaseSnapshot()).toEqual(before);
      expect(api.getStoreSnapshot()).toBe(observerSnapshot);
      expect(api.getStorageState().status).toBe('ready');
      expect(Array.from((await idb.readBlob(evidence.raw.id)).bytes)).toEqual(Array.from(evidence.raw.bytes));
    } finally { fault.restore(); }
    await garbageCollect();
    expect(await idb.readCurrent()).toEqual(before.current);
    expect(await idb.getGeneration(roots.original.id)).toEqual(roots.original);
    expect(await idb.getGeneration(evidence.quarantine.id)).toEqual(evidence.quarantine);
    await expect(idb.getGeneration(evidence.expired.id)).rejects.toMatchObject({ code: 'missing-generation' });
    await expect(idb.readBlob(evidence.orphan.id)).rejects.toMatchObject({ code: 'missing-blob' });
    await expect(idb.readBlob(evidence.expiredBytes.id)).rejects.toMatchObject({ code: 'missing-blob' });
    expect((await records<Pin>('pins')).map(pin => pin.id)).toContain(roots.pin.id);
    expect((await records<Pin>('pins')).map(pin => pin.id)).not.toContain(evidence.expiredPin.id);
    const rescue = await readRecoverySnapshot();
    expect(rescue.current).toEqual(before.current);
    expect(rescue.readableGeneration).toBe(roots.current.id);
    expect(rescue.files.some(file => Array.from(file.bytes).join(',') === Array.from(evidence.raw.bytes).join(','))).toBe(true);
    expect((await api.readFullRecord(roots.id)).hits).toEqual(roots.hits);
    await verifyHealthyGeneration(await currentGeneration());
  });

  it('does not turn successful queued publication into a failure when its maintenance GC aborts', async () => {
    const roots = await queuedRoots(), evidence = await addEvidence(roots.original);
    const fault = await abortAfterDelete('generations', evidence.expired.id);
    const intended = { ...hit('saved-despite-maintenance-fault', Date.UTC(2026, 10, 6)), extra: { preserved: [false, null] } };
    try {
      const receipt = await api.appendHit(roots.id, intended);
      expect(receipt.revision).toBe('7');
      expect(api.getAccountSnapshot(roots.id)?.total).toBe(6);
      // This is also a transaction barrier behind the command's unawaited maintenance.
      await expect(garbageCollect()).rejects.toThrow();
      expect(fault.succeeded()).toBeGreaterThanOrEqual(1);
      expect(await idb.readCurrent()).toMatchObject({ generation: receipt.generation, revision: receipt.revision });
      expect(await idb.getGeneration(evidence.expired.id)).toEqual(evidence.expired);
      expect(Array.from((await idb.readBlob(evidence.raw.id)).bytes)).toEqual(Array.from(evidence.raw.bytes));
      expect((await api.readFullRecord(roots.id)).hits).toEqual([...roots.hits, intended]);
      expect(api.getStorageState().status).toBe('ready');
    } finally { fault.restore(); }
    await garbageCollect();
    expect(await idb.getGeneration(evidence.quarantine.id)).toEqual(evidence.quarantine);
    await verifyHealthyGeneration(await currentGeneration());
  });
});

describe('reader leases across separate real IDB connections', () => {
  it('keeps an in-progress reader generation and all referenced bytes live while another connection collects newer committed history', async () => {
    const receipt = await api.createAccount('pinned-live-reader');
    if (!receipt.accountId) throw new Error('Expected an account UUID.');
    const id = receipt.accountId;
    vi.resetModules();
    const otherIDB = await import('./idb'), otherRecovery = await import('./recovery');
    secondConnections.push(otherIDB);
    expect(await idb.openDatabase()).not.toBe(await otherIDB.openDatabase());
    let original: Generation | undefined;
    const read = await withPinnedGeneration(async pinned => {
      original = pinned;
      for (let index = 0; index < 5; index++) await api.appendHit(id, hit(`while-reading-${index}`, index));
      await otherRecovery.garbageCollect();
      expect((await otherIDB.getGeneration(pinned.id)).map).toEqual(pinned.map);
      for (const [path, blobId] of Object.entries(pinned.map)) {
        const blob = await otherIDB.readBlob(blobId);
        expect(blob.id).toBe(blobId);
        if (path === 'manifest.json') expect(blob.sha256).toBe(pinned.manifestDigest);
      }
      const profile = await readFile<Envelope<{ fields: Record<string, unknown> }>>(pinned, `accounts/${id}/profile.json`);
      return { generation: pinned.id, profile };
    });
    expect(read.generation).toBe(original?.id);
    expect(read.profile.payload.fields).toEqual({});
    expect((await records<Pin>('pins')).some(pin => pin.generation === original?.id)).toBe(false);
    await otherRecovery.garbageCollect();
    await expect(otherIDB.getGeneration(read.generation)).rejects.toMatchObject({ code: 'missing-generation' });
    expect((await api.readFullRecord(id)).hits).toHaveLength(5);
    await otherRecovery.verifyHealthyGeneration(await currentGeneration());
  });

  it('does not extend a local reader lease when renewal put succeeds but its transaction aborts', async () => {
    const roots = await queuedRoots(), originalExpiry = roots.pin.expiresAt;
    const clock = vi.spyOn(Date, 'now').mockReturnValue(Date.now() + 1_000);
    const db = await idb.openDatabase(), transaction = db.transaction.bind(db);
    let putSucceeded = false;
    const spy = vi.spyOn(db, 'transaction').mockImplementation((...args: Parameters<IDBDatabase['transaction']>) => {
      const tx = transaction(...args);
      if (args[1] === 'readwrite') {
        const pins = tx.objectStore('pins'), put = pins.put.bind(pins);
        vi.spyOn(pins, 'put').mockImplementation((...putArgs: Parameters<IDBObjectStore['put']>) => {
          const operation = put(...putArgs);
          if (putArgs[1] === roots.pin.id) operation.addEventListener('success', () => { putSucceeded = true; tx.abort(); }, { once: true });
          return operation;
        });
      }
      return tx;
    });
    try {
      await expect(idb.renewPin(roots.pin)).rejects.toThrow();
      expect(putSucceeded).toBe(true);
      expect(roots.pin.expiresAt).toBe(originalExpiry);
      expect((await records<Pin>('pins')).find(pin => pin.id === roots.pin.id)?.expiresAt).toBe(originalExpiry);
    } finally { spy.mockRestore(); }
    try {
      clock.mockReturnValue(originalExpiry + 1);
      await expect(idb.renewPin(roots.pin)).rejects.toMatchObject({ code: 'expired-reader' });
      const snapshot = await databaseSnapshot();
      const fault = await abortAfterDelete('pins', roots.pin.id);
      try {
        await expect(garbageCollect()).rejects.toThrow();
        expect(fault.succeeded()).toBe(1);
        expect(await databaseSnapshot()).toEqual(snapshot);
      } finally { fault.restore(); }
      await garbageCollect();
      await expect(idb.pinGeneration(roots.original.id)).rejects.toMatchObject({ code: 'expired-reader' });
      expect((await api.readFullRecord(roots.id)).hits).toEqual(roots.hits);
    } finally { clock.mockRestore(); }
  });
});
