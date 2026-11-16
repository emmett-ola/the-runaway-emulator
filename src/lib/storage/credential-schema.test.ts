import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';
import { createAccount, initializeStorage, readFullRecord, readRecord, resetStorage } from './index';
import { closeDatabase, completed, DATABASE_NAME, DATABASE_VERSION, openDatabase, readCurrent, request } from './idb';
import { createCredential } from '../identity/password';

beforeEach(async () => {
  await resetStorage();
  Object.defineProperty(globalThis, 'indexedDB', { configurable: true, value: new IDBFactory() });
});
afterEach(async () => { vi.restoreAllMocks(); await resetStorage(); });
const rawOpen = (version: number) => new Promise<IDBDatabase>((resolve, reject) => {
  const operation = indexedDB.open(DATABASE_NAME, version);
  operation.onupgradeneeded = () => ['control', 'generations', 'blobs', 'pins'].forEach(name => {
    if (!operation.result.objectStoreNames.contains(name)) operation.result.createObjectStore(name);
  });
  operation.onsuccess = () => resolve(operation.result);
  operation.onerror = () => reject(operation.error);
});
const originalSchema = async () => {
  await initializeStorage();
  await createAccount('retained-v1');
  const before = await readFullRecord('retained-v1'), pointer = await readCurrent();
  const source = await openDatabase();
  const records = new Map<string, [IDBValidKey[], unknown[]]>();
  for (const name of ['control', 'generations', 'blobs', 'pins']) {
    const tx = source.transaction(name, 'readonly'), done = completed(tx), store = tx.objectStore(name);
    const keys = await request(store.getAllKeys()), values: unknown[] = await request(store.getAll());
    await done; records.set(name, [keys, values]);
  }
  await resetStorage();
  Object.defineProperty(globalThis, 'indexedDB', { configurable: true, value: new IDBFactory() });
  const v1 = await rawOpen(1);
  const tx = v1.transaction([...records.keys()], 'readwrite'), done = completed(tx);
  for (const [name, [keys, values]] of records) keys.forEach((key, index) => tx.objectStore(name).put(values[index], key));
  await done;
  v1.close();
  return { before, pointer };
};
describe('credential schema upgrade and connection diagnostics', () => {
  it('upgrades a real schema-1 committed tree without changing its current pointer or existing records', async () => {
    const { before, pointer } = await originalSchema();
    await initializeStorage();
    expect((await openDatabase()).version).toBe(DATABASE_VERSION);
    expect((await openDatabase()).objectStoreNames.contains('credentials')).toBe(true);
    expect(await readCurrent()).toEqual(pointer);
    expect(await readFullRecord('retained-v1')).toEqual(before);
    expect((await readRecord('retained-v1'))?.accountId).toBe(before.accountId);
    const db = await openDatabase(), tx = db.transaction('credentials', 'readonly'), done = completed(tx);
    expect(await request(tx.objectStore('credentials').count())).toBe(0);
    await done;
  });
  it('rejects a blocked upgrade with actionable diagnostics and closes the late successful connection', async () => {
    const old = await rawOpen(1);
    await expect(openDatabase()).rejects.toMatchObject({ code: 'upgrade-blocked' });
    old.close();
    await new Promise(resolve => setTimeout(resolve, 10));
    await closeDatabase();
    expect((await openDatabase()).version).toBe(2);
  });
  it('closes an obsolete connection on versionchange and requires a reload instead of continuing writes', async () => {
    const db = await openDatabase();
    const newer = await rawOpen(3);
    expect(newer.version).toBe(3);
    expect(() => db.transaction('control')).toThrow();
    await expect(openDatabase()).rejects.toMatchObject({ code: 'version-changed' });
    newer.close();
    await closeDatabase();
    await expect(openDatabase()).rejects.toMatchObject({ name: 'VersionError' });
  });
  it('fails closed when real WebCrypto cannot derive a new credential', async () => {
    await initializeStorage();
    const derive = vi.spyOn(crypto.subtle, 'deriveBits').mockRejectedValue(new DOMException('unavailable', 'NotSupportedError'));
    await expect(createCredential(`SYNTHETIC-ONLY-${crypto.randomUUID()}`)).rejects.toThrow();
    derive.mockRestore();
    expect(await readCurrent()).toBeNull();
  });
});
