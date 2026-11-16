import { describe, expect, it, vi } from 'vitest';
import { appendHit, createAccount, getAccountSnapshot, getStorageState, getStoreSnapshot, initializeStorage, readFullRecord, readRecord, resetStorage } from './index';
import { buildCandidate, commitPrepared, prepare, verifyPrepared } from './commit';
import { accountPath, makeBlob, readFile } from './files';
import { emptyIndex } from './chunks';
import { getGeneration, openDatabase, readCurrent } from './idb';
import { getPreferencesSnapshot } from './preferences';
import { publishGeneration, subscribe } from './snapshot';
import type { BlobRecord, Generation, Manifest } from './state-model';

const currentGeneration = async (): Promise<Generation> => {
  const current = await readCurrent();
  if (!current) throw new Error('Expected a committed current generation.');
  return getGeneration(current.generation);
};
const create = async (handle = 'publication') => {
  const receipt = await createAccount(handle);
  if (!receipt.accountId) throw new Error('Missing account UUID.');
  return receipt.accountId;
};
const deferred = () => {
  let resolve!: () => void;
  const promise = new Promise<void>(done => { resolve = done; });
  return { promise, resolve };
};

/** Wrap real fake-IDB requests/transactions, not their results or persistence. */
const interceptPointer = async (intercept: (tx: IDBTransaction, operation: IDBRequest<IDBValidKey>) => void) => {
  const db = await openDatabase();
  const realTransaction = db.transaction.bind(db);
  const methods: { mockRestore(): void }[] = [];
  const spy = vi.spyOn(db, 'transaction').mockImplementation((...args: Parameters<IDBDatabase['transaction']>) => {
    const tx = realTransaction(...args);
    if (args[1] === 'readwrite') {
      const control = tx.objectStore('control');
      const realPut = control.put.bind(control);
      methods.push(vi.spyOn(control, 'put').mockImplementation((...putArgs: Parameters<IDBObjectStore['put']>) => {
        const operation = realPut(...putArgs);
        if (putArgs[1] === 'current') intercept(tx, operation);
        return operation;
      }));
    }
    return tx;
  });
  return () => { spy.mockRestore(); methods.forEach(method => method.mockRestore()); };
};

describe('publication completion and revision fences', () => {
  it('keeps the previous committed generation readable after reload when interrupted before pointer publication', async () => {
    const id = await create();
    await appendHit(id, { id: 'already-committed', at: 0, schemaVersion: 1, recordVersion: '1', extra: [null, '雪'] });
    const before = await readCurrent(), record = await readFullRecord(id);
    const base = await currentGeneration();
    const manifest = await readFile<Manifest>(base, 'manifest.json');
    const extensions = await readFile<unknown>(base, 'shared/extensions.json');
    const candidate = await buildCandidate(base, new Map([['shared/extensions.json', await makeBlob({ unpublished: true }, String(BigInt(base.revision) + 1n))]]), manifest.deviceId);
    await prepare(candidate); await verifyPrepared(candidate);
    expect((await getGeneration(candidate.generation.id)).state).toBe('staged');
    expect(await readCurrent()).toEqual(before);

    // Simulate stopping after verified staging: never invoke the pointer transaction.
    // Closing/reopening fake-IDB tests restart visibility, not physical power loss.
    await resetStorage(); await initializeStorage();
    expect(await readCurrent()).toEqual(before);
    expect((await currentGeneration()).id).toBe(base.id);
    expect(await readFullRecord(id)).toEqual(record);
    expect(getAccountSnapshot(id)?.total).toBe(1);
    expect(await readFile<unknown>(await currentGeneration(), 'shared/extensions.json')).toEqual(extensions);
    expect((await getGeneration(candidate.generation.id)).state).toBe('staged');
    expect(await readFile<unknown>(candidate.generation, 'shared/extensions.json')).toEqual({ unpublished: true });
  });

  it('rejects a command if the pointer transaction aborts after put success, without publishing a snapshot', async () => {
    const id = await create();
    const before = await readCurrent(), snapshot = getStoreSnapshot(), state = getStorageState();
    const notifications = vi.fn(), unsubscribe = subscribe(notifications);
    let putSucceeded = false;
    const restore = await interceptPointer((tx, operation) => {
      operation.addEventListener('success', () => { putSucceeded = true; tx.abort(); }, { once: true });
    });
    try {
      await expect(appendHit(id, { id: 'must-not-publish', at: 0, schemaVersion: 1, recordVersion: '1' })).rejects.toThrow();
      expect(putSucceeded).toBe(true);
      expect(await readCurrent()).toEqual(before);
      expect(getStoreSnapshot()).toBe(snapshot);
      expect(getStorageState()).toBe(state);
      expect(getAccountSnapshot(id)?.total).toBe(0);
      expect(notifications).not.toHaveBeenCalled();
    } finally { restore(); unsubscribe(); }
    await appendHit(id, { id: 'safe-retry', at: 1, schemaVersion: 1, recordVersion: '1' });
    expect((await readFullRecord(id)).hits.map(hit => hit.id)).toEqual(['safe-retry']);
  });

  it('does not resolve publication from pointer put success before the completion callback', async () => {
    await create();
    const base = await currentGeneration();
    const manifest = await readFile<Manifest>(base, 'manifest.json');
    const candidate = await buildCandidate(base, new Map([['shared/extensions.json', await makeBlob({ completion: true }, String(BigInt(base.revision) + 1n))]]), manifest.deviceId);
    await prepare(candidate); await verifyPrepared(candidate);
    const db = await openDatabase(), real = db.transaction.bind(db);
    const reached = deferred();
    let release: (() => void) | undefined, settled = false;
    const spy = vi.spyOn(db, 'transaction').mockImplementation((...args: Parameters<IDBDatabase['transaction']>) => {
      const tx = real(...args);
      if (args[1] === 'readwrite') {
        Object.defineProperty(tx, 'oncomplete', { configurable: true, set(handler: ((event: Event) => void) | null) {
          tx.addEventListener('complete', event => { release = () => handler?.call(tx, event); reached.resolve(); }, { once: true });
        } });
      }
      return tx;
    });
    try {
      const publication = commitPrepared(candidate).then(() => { settled = true; });
      try {
        await reached.promise;
        await Promise.resolve();
        expect(settled).toBe(false);
        expect((await readCurrent())?.generation).toBe(candidate.generation.id);
        expect(release).toBeTypeOf('function');
      } finally { release?.(); await publication; }
      expect(settled).toBe(true);
    } finally { spy.mockRestore(); }
  });

  it('preserves an accepted __proto__ handle, its UUID and hits across reload', async () => {
    const id = await create('__proto__');
    await appendHit(id, { id: 'prototype-safe', at: 0, schemaVersion: 1, recordVersion: '1', extra: [null, '原始'] });
    expect(Object.hasOwn(getStoreSnapshot().users, '__proto__')).toBe(true);
    expect(getAccountSnapshot('__proto__')?.accountId).toBe(id);
    await resetStorage(); await initializeStorage();
    expect(Object.hasOwn(getStoreSnapshot().users, '__proto__')).toBe(true);
    expect(await readRecord('__proto__')).toMatchObject({ accountId: id, username: '__proto__', total: 1 });
    expect((await readFullRecord(id)).hits).toEqual([{ id: 'prototype-safe', at: 0, schemaVersion: 1, recordVersion: '1', extra: [null, '原始'] }]);
    expect(Object.getPrototypeOf(getStoreSnapshot().users)).toBeNull();
  });

  it('refuses to roll a newer immutable snapshot back when older hydration finishes later', async () => {
    const id = await create();
    const older = await currentGeneration();
    await appendHit(id, { id: 'newer-receipt', at: 1, schemaVersion: 1, recordVersion: '1' });
    const pointer = await readCurrent(), snapshot = getStoreSnapshot(), state = getStorageState();
    const notifications = vi.fn(), unsubscribe = subscribe(notifications);
    try {
      await publishGeneration(older);
      expect(getStoreSnapshot()).toBe(snapshot);
      expect(getStorageState()).toBe(state);
      expect(getAccountSnapshot(id)?.total).toBe(1);
      expect(notifications).not.toHaveBeenCalled();
      expect(await readCurrent()).toEqual(pointer);
    } finally { unsubscribe(); }
  });
});

const absentCandidate = async (handle: string) => {
  const id = crypto.randomUUID(), root = accountPath(id), deviceId = crypto.randomUUID(), now = Date.now();
  const envelope = (payload: unknown) => ({ accountId: id, schemaVersion: 1, recordVersion: '1', createdAt: now, updatedAt: now, payload });
  const files: [string, unknown][] = [
    ['shared/accounts.json', { schemaVersion: 1, recordVersion: '1', accounts: [{ accountId: id, handle, registeredAt: now }] }],
    ['shared/extensions.json', {}], ['shared/export-metadata.json', {}], ['device/preferences.json', getPreferencesSnapshot()],
    [`${root}/account.json`, envelope({ handle, registeredAt: now, extensions: {} })],
    [`${root}/profile.json`, envelope({ fields: {}, emailVerification: 'unverified' })],
    [`${root}/settings.json`, envelope({})], [`${root}/extensions.json`, envelope({})],
    [`${root}/plugins/games.json`, { ...envelope({ settings: {}, cardCollections: {} }), pluginId: 'games' }],
    [`${root}/run/index.json`, emptyIndex(id, '1')], [`${root}/imports/index.json`, envelope([])],
  ];
  const changes = new Map<string, BlobRecord>();
  for (const [path, value] of files) changes.set(path, await makeBlob(value, '1'));
  return buildCandidate(null, changes, deviceId);
};

describe('absent-current compare-and-swap', () => {
  it.each([['same', 'same'], ['first', 'different']])('allows only one verified first candidate to publish (%s / %s)', async (first, second) => {
    const a = await absentCandidate(first), b = await absentCandidate(second);
    await prepare(a); await prepare(b);
    await verifyPrepared(a); await verifyPrepared(b);
    expect(await readCurrent()).toBeNull();
    const outcomes = await Promise.allSettled([commitPrepared(a), commitPrepared(b)]);
    expect(outcomes.filter(outcome => outcome.status === 'fulfilled')).toHaveLength(1);
    const rejection = outcomes.find(outcome => outcome.status === 'rejected');
    expect(rejection?.status === 'rejected' && rejection.reason).toMatchObject({ code: 'conflict' });
    const current = await currentGeneration();
    expect([a.generation.id, b.generation.id]).toContain(current.id);
    expect(current.state).toBe('committed');
    const loser = current.id === a.generation.id ? b : a;
    expect((await getGeneration(loser.generation.id)).state).toBe('staged');
    const manifest = await readFile<Manifest>(current, 'manifest.json');
    expect(manifest.revision).toBe('1');
    expect(getStorageState().revision).toBe('0'); // Low-level commits never acknowledge a UI snapshot.
  });
});
