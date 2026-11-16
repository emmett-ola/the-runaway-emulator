import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { webcrypto } from 'node:crypto';
import { IDBFactory } from 'fake-indexeddb';
import { decodeCanonical } from '../../../shared/codec';
import { resetStorage as resetSetupStorage } from './index';
import type { Hit } from './model';
import type { Envelope, Generation } from './state-model';

interface Tab {
  api: typeof import('./index');
  idb: typeof import('./idb');
  commit: typeof import('./commit');
  files: typeof import('./files');
  recovery: typeof import('./recovery');
}
const tabs: Tab[] = [];
const cleanups: (() => void)[] = [];
const deferred = () => {
  let resolve!: () => void;
  const promise = new Promise<void>(done => { resolve = done; });
  return { promise, resolve };
};
const hit = (id: string, at: number): Hit => ({ id, at, schemaVersion: 1, recordVersion: '1' });
const openTab = async (): Promise<Tab> => {
  // Each import graph owns its own command queue, snapshot, initialization and IDB handle.
  vi.resetModules();
  const api = await import('./index');
  const tab = { api, idb: await import('./idb'), commit: await import('./commit'), files: await import('./files'), recovery: await import('./recovery') };
  tabs.push(tab);
  await api.initializeStorage();
  return tab;
};
const generation = async (tab: Tab): Promise<Generation> => {
  const current = await tab.idb.readCurrent();
  if (!current) throw new Error('Expected a committed current generation.');
  return tab.idb.getGeneration(current.generation);
};
const accountId = (receipt: { accountId?: string }): string => {
  if (!receipt.accountId) throw new Error('Account creation did not return a UUID.');
  return receipt.accountId;
};
/** Pause one actual SHA-256 invocation outside IDB, without stubbing its result. */
const pauseDigest = (matches: (source: string) => boolean) => {
  const reached = deferred(), release = deferred();
  const subtle = crypto.subtle, digest = subtle.digest.bind(subtle);
  let paused = false, source = '';
  const spy = vi.spyOn(subtle, 'digest').mockImplementation(async (...args: Parameters<SubtleCrypto['digest']>) => {
    const result = digest(...args);
    const text = new TextDecoder().decode(args[1]);
    if (!paused && matches(text)) {
      paused = true; source = text; reached.resolve();
      await release.promise;
    }
    return result;
  });
  cleanups.push(() => { release.resolve(); spy.mockRestore(); });
  return { reached: reached.promise, release: release.resolve, source: () => source };
};
const observeAborts = async (tab: Tab) => {
  const db = await tab.idb.openDatabase(), transaction = db.transaction.bind(db);
  let aborts = 0;
  const spy = vi.spyOn(db, 'transaction').mockImplementation((...args: Parameters<IDBDatabase['transaction']>) => {
    const tx = transaction(...args);
    if (args[1] === 'readwrite') tx.addEventListener('abort', () => { aborts++; });
    return tx;
  });
  cleanups.push(() => spy.mockRestore());
  return () => aborts;
};

beforeEach(async () => {
  await resetSetupStorage();
  vi.stubGlobal('indexedDB', new IDBFactory());
  vi.stubGlobal('crypto', webcrypto);
  // Deliberately drop advisory notifications: revision CAS, not a channel, must ensure safety.
  vi.stubGlobal('BroadcastChannel', undefined);
});
afterEach(async () => {
  cleanups.splice(0).reverse().forEach(cleanup => cleanup());
  vi.restoreAllMocks();
  for (const tab of tabs) await tab.api.garbageCollect();
  for (const tab of tabs.splice(0)) await tab.api.resetStorage();
  vi.unstubAllGlobals();
});

describe('independent tab-like command queues over real IndexedDB', () => {
  it('rebases a queued append after a real CAS conflict, preserving its frozen id, time and canonical extras', async () => {
    const a = await openTab(), id = accountId(await a.api.createAccount('append-race'));
    const b = await openTab();
    expect(a.api.appendHit).not.toBe(b.api.appendHit);
    expect(await a.idb.openDatabase()).not.toBe(await b.idb.openDatabase());
    const deviceId = await a.commit.getDeviceId(), registeredAt = a.api.getAccountSnapshot(id)?.registeredAt;
    const original = { ...hit('paused-intent', Date.UTC(2026, 10, 2)), extra: [null, { text: '雪', enabled: false }] };
    const mutable = structuredClone(original);
    const gate = pauseDigest(source => source.includes('"entries"') && source.includes('"id":"paused-intent"'));
    const aborts = await observeAborts(a);
    const pending = a.api.appendHit(id, mutable);
    mutable.id = 'caller-mutated'; mutable.at = 0; mutable.extra[1] = null;
    try {
      await gate.reached;
      const other = hit('other-tab', Date.UTC(2026, 10, 1));
      const winner = await b.api.appendHit(id, other);
      expect(winner.revision).toBe('2'); // B commits while A's independent queue is suspended.
      expect(a.api.getAccountSnapshot(id)?.total).toBe(0);
      gate.release();
      const rebased = await pending;
      expect(rebased.revision).toBe('3');
      expect(aborts()).toBeGreaterThanOrEqual(1);
      expect((await a.api.readFullRecord(id)).hits).toEqual([other, original]);
      expect((await b.api.readFullRecord(id)).hits).toEqual([other, original]);
      expect(a.api.getAccountSnapshot(id)?.registeredAt).toBe(registeredAt);
      expect(await a.commit.getDeviceId()).toBe(deviceId);
      expect(await a.idb.readCurrent()).toMatchObject({ generation: rebased.generation, revision: '3' });
      await a.recovery.verifyHealthyGeneration(await generation(a));
    } finally { gate.release(); await pending.catch(() => undefined); }
  });

  it('reuses the winning UUID, registration, profile and device identity when same-handle first-account commands race', async () => {
    const a = await openTab(), b = await openTab();
    expect(await a.idb.readCurrent()).toBeNull();
    const gate = pauseDigest(source => source.includes('"payload":{"extensions":{},"handle":"same-first"'));
    const aborts = await observeAborts(a);
    const pending = a.api.createAccount('same-first', { owner: 'losing-tab', optional: null });
    try {
      await gate.reached;
      const firstIdentity: unknown = decodeCanonical(gate.source());
      if (!firstIdentity || typeof firstIdentity !== 'object' || Array.isArray(firstIdentity) || !('accountId' in firstIdentity) || typeof firstIdentity.accountId !== 'string') throw new Error('Expected the losing first-account identity.');
      const winner = await b.api.createAccount('same-first', { owner: 'winning-tab', optional: ['kept', null] });
      const id = accountId(winner), registration = b.api.getAccountSnapshot(id)?.registeredAt;
      const deviceId = await b.commit.getDeviceId();
      expect(winner.revision).toBe('1');
      expect(winner.generation.startsWith('0-')).toBe(true);
      expect(a.api.getStoreSnapshot().users).toEqual({});
      gate.release();
      const loser = await pending;
      expect(loser.accountId).toBe(id);
      expect(loser.revision).toBe('2');
      expect(aborts()).toBeGreaterThanOrEqual(1);
      const store = await a.api.readStore();
      expect(Object.keys(store.users)).toEqual(['same-first']);
      expect(id).not.toBe(firstIdentity.accountId);
      expect(store.users['same-first']).toMatchObject({ accountId: id, registeredAt: registration, total: 0, profile: { owner: 'winning-tab', optional: ['kept', null] } });
      const tree = await generation(a);
      const identity = await a.files.readFile<Envelope<{ handle: string; registeredAt: number }>>(tree, `accounts/${id}/account.json`);
      expect(identity.payload.registeredAt).toBe(registration);
      expect(identity.createdAt).toBe(identity.updatedAt);
      expect(identity.recordVersion).toBe('1');
      expect(await a.commit.getDeviceId()).toBe(deviceId);
      expect(Object.keys(tree.map).filter(path => path.endsWith('/account.json'))).toEqual([`accounts/${id}/account.json`]);
      expect((await b.api.readRecord(id))?.accountId).toBe(id);
    } finally { gate.release(); await pending.catch(() => undefined); }
  });

  it('rebases different-handle first-account commands into two isolated UUID trees without replacing the winning device', async () => {
    const a = await openTab(), b = await openTab();
    const gate = pauseDigest(source => source.includes('"payload":{"extensions":{},"handle":"first-a"'));
    const aborts = await observeAborts(a);
    const pending = a.api.createAccount('first-a', { marker: ['a', null] });
    try {
      await gate.reached;
      const firstIdentity: unknown = decodeCanonical(gate.source());
      if (!firstIdentity || typeof firstIdentity !== 'object' || Array.isArray(firstIdentity) || !('accountId' in firstIdentity) || typeof firstIdentity.accountId !== 'string') throw new Error('Expected the original queued account identity.');
      const winner = await b.api.createAccount('first-b', { marker: ['b', 0] });
      const deviceId = await b.commit.getDeviceId();
      gate.release();
      const rebased = await pending, idA = accountId(rebased), idB = accountId(winner);
      expect(idA).toBe(firstIdentity.accountId); // The original creation intent is not reallocated on retry.
      expect(idA).not.toBe(idB);
      expect(winner.revision).toBe('1'); expect(rebased.revision).toBe('2');
      expect(aborts()).toBeGreaterThanOrEqual(1);
      const store = await a.api.readStore();
      expect(Object.keys(store.users)).toEqual(['first-b', 'first-a']);
      expect(store.users['first-a']).toMatchObject({ accountId: idA, profile: { marker: ['a', null] }, total: 0 });
      expect(store.users['first-b']).toMatchObject({ accountId: idB, profile: { marker: ['b', 0] }, total: 0 });
      expect(await a.commit.getDeviceId()).toBe(deviceId);
      const tree = await generation(a);
      for (const id of [idA, idB]) {
        const identity = await a.files.readFile<Envelope<{ handle: string; registeredAt: number }>>(tree, `accounts/${id}/account.json`);
        expect(identity.accountId).toBe(id);
        expect(identity.payload.registeredAt).toBe(store.users[identity.payload.handle].registeredAt);
      }
      expect(Object.keys(tree.map).filter(path => /\/run\/y/.test(path))).toEqual([]);
    } finally { gate.release(); await pending.catch(() => undefined); }
  });

  it('keeps a paused append bound to its UUID when another tab renames the handle and creates a replacement', async () => {
    const a = await openTab(), id = accountId(await a.api.createAccount('original-handle'));
    const registration = a.api.getAccountSnapshot(id)?.registeredAt, b = await openTab();
    const intended = hit('uuid-bound', Date.UTC(2026, 10, 4));
    const gate = pauseDigest(source => source.includes('"entries"') && source.includes('"id":"uuid-bound"'));
    const aborts = await observeAborts(a);
    const pending = a.api.appendHit(id, intended);
    try {
      await gate.reached;
      await b.api.renameAccount(id, 'renamed-handle');
      const replacementId = accountId(await b.api.createAccount('original-handle'));
      expect(replacementId).not.toBe(id);
      gate.release();
      const receipt = await pending;
      expect(receipt.accountId).toBe(id); expect(receipt.revision).toBe('4');
      expect(aborts()).toBeGreaterThanOrEqual(1);
      expect(await a.api.readFullRecord(id)).toMatchObject({ username: 'renamed-handle', registeredAt: registration, hits: [intended] });
      expect(await b.api.readFullRecord(replacementId)).toMatchObject({ username: 'original-handle', hits: [] });
      expect((await a.api.readRecord('original-handle'))?.accountId).toBe(replacementId);
      expect((await a.api.readRecord('renamed-handle'))?.accountId).toBe(id);
    } finally { gate.release(); await pending.catch(() => undefined); }
  });

  it('rejects the losing duplicate-id intent after rebase and leaves both independent queues usable', async () => {
    const a = await openTab(), id = accountId(await a.api.createAccount('duplicate-race')), b = await openTab();
    const loser = { ...hit('same-id', 10), origin: 'loser' }, winner = { ...hit('same-id', 20), origin: 'winner' };
    const gate = pauseDigest(source => source.includes('"entries"') && source.includes('"origin":"loser"'));
    const aborts = await observeAborts(a);
    const pending = a.api.appendHit(id, loser);
    // Attach rejection observation before releasing the losing intent.
    const rejected = expect(pending).rejects.toMatchObject({ code: 'duplicate-hit' });
    try {
      await gate.reached;
      const saved = await b.api.appendHit(id, winner);
      gate.release(); await rejected;
      expect(aborts()).toBeGreaterThanOrEqual(1);
      expect(await a.idb.readCurrent()).toMatchObject({ generation: saved.generation, revision: '2' });
      expect(a.api.getStorageState().status).toBe('ready');
      const retryA = hit('safe-a', 30), retryB = hit('safe-b', 40);
      await a.api.appendHit(id, retryA); await b.api.appendHit(id, retryB);
      expect((await a.api.readFullRecord(id)).hits).toEqual([winner, retryA, retryB]);
      expect((await b.api.readFullRecord(id)).hits).toEqual([winner, retryA, retryB]);
    } finally { gate.release(); await pending.catch(() => undefined); }
  });
});
