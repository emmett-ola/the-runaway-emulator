import type { BlobRecord, Current, Generation, Pin } from './state-model';

export const DATABASE_NAME = 'runawaylog-vfiles';
export const DATABASE_VERSION = 2;
const stores = ['control', 'generations', 'blobs', 'pins', 'credentials'];
let opening: Promise<IDBDatabase> | undefined;
let versionChanged = false;
export class StorageError extends Error {
  code: string;
  constructor(code: string, message: string) { super(message); this.code = code; this.name = 'StorageError'; }
}
export class ConflictError extends StorageError {
  constructor() { super('conflict', 'The committed generation changed; retry the original intent.'); }
}
export const request = <T>(value: IDBRequest<T>): Promise<T> => new Promise((resolve, reject) => {
  value.onsuccess = () => resolve(value.result);
  value.onerror = () => reject(value.error ?? new StorageError('idb', 'IndexedDB request failed.'));
});
export const completed = (tx: IDBTransaction): Promise<void> => new Promise((resolve, reject) => {
  tx.oncomplete = () => resolve();
  tx.onabort = () => reject(tx.error ?? new StorageError('aborted', 'IndexedDB transaction aborted.'));
  tx.onerror = () => { /* Abort, not individual request success, settles the transaction. */ };
});
export const openDatabase = (): Promise<IDBDatabase> => {
  if (versionChanged) return Promise.reject(new StorageError('version-changed', 'Local storage changed in another tab; reload this page.'));
  opening ??= new Promise((resolve, reject) => {
    if (!globalThis.indexedDB) { reject(new StorageError('unavailable', 'IndexedDB is unavailable.')); return; }
    let rejected = false;
    const operation = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    operation.onupgradeneeded = () => stores.forEach(name => {
      if (!operation.result.objectStoreNames.contains(name)) operation.result.createObjectStore(name);
    });
    operation.onerror = () => { opening = undefined; reject(operation.error ?? new StorageError('open', 'Cannot open local storage.')); };
    operation.onblocked = () => { rejected = true; opening = undefined; reject(new StorageError('upgrade-blocked', 'Close obsolete tabs before opening storage.')); };
    operation.onsuccess = () => {
      const db = operation.result;
      if (rejected) { db.close(); return; }
      db.onversionchange = () => { db.close(); opening = undefined; versionChanged = true; };
      resolve(db);
    };
  });
  return opening;
};
export const transaction = (db: IDBDatabase, mode: IDBTransactionMode): IDBTransaction => {
  if (mode === 'readwrite') {
    try { return db.transaction(stores, mode, { durability: 'strict' }); }
    catch (error) { if (!(error instanceof TypeError)) throw error; }
  }
  return db.transaction(stores, mode);
};
export const readCurrent = async (): Promise<Current | null> => {
  const db = await openDatabase();
  const tx = transaction(db, 'readonly');
  const done = completed(tx);
  const current = await request<Current | undefined>(tx.objectStore('control').get('current'));
  await done;
  return current ?? null;
};
export const getGeneration = async (id: string): Promise<Generation> => {
  const db = await openDatabase();
  const tx = transaction(db, 'readonly');
  const done = completed(tx);
  const generation = await request<Generation | undefined>(tx.objectStore('generations').get(id));
  await done;
  if (!generation) throw new StorageError('missing-generation', 'The published generation is missing.');
  return generation;
};
export const readBlob = async (id: string): Promise<BlobRecord> => {
  const db = await openDatabase();
  const tx = transaction(db, 'readonly');
  const done = completed(tx);
  const blob = await request<BlobRecord | undefined>(tx.objectStore('blobs').get(id));
  await done;
  if (!blob) throw new StorageError('missing-blob', 'A referenced virtual file is missing.');
  return blob;
};
export const pinGeneration = async (generation: string): Promise<Pin> => {
  const db = await openDatabase();
  const tx = transaction(db, 'readwrite');
  const done = completed(tx);
  const pin = { id: crypto.randomUUID(), generation, expiresAt: Date.now() + 120_000 };
  const existing = await request<Generation | undefined>(tx.objectStore('generations').get(generation));
  if (!existing) { tx.abort(); await done.catch(() => undefined); throw new StorageError('expired-reader', 'Reader must restart at the latest generation.'); }
  tx.objectStore('pins').put(pin, pin.id);
  await done;
  return pin;
};
export const releasePin = async (pin: Pin): Promise<void> => {
  const db = await openDatabase();
  const tx = transaction(db, 'readwrite');
  const done = completed(tx);
  tx.objectStore('pins').delete(pin.id);
  await done;
};
export const renewPin = async (pin: Pin): Promise<void> => {
  if (pin.expiresAt <= Date.now()) throw new StorageError('expired-reader', 'Reader lease expired; restart the operation.');
  const db = await openDatabase();
  const tx = transaction(db, 'readwrite');
  const done = completed(tx);
  const existing = await request<Generation | undefined>(tx.objectStore('generations').get(pin.generation));
  const stored = await request<Pin | undefined>(tx.objectStore('pins').get(pin.id));
  if (!existing || !stored || stored.expiresAt <= Date.now()) {
    tx.abort(); await done.catch(() => undefined);
    throw new StorageError('expired-reader', 'Reader lease expired; restart the operation.');
  }
  const expiresAt = Date.now() + 120_000;
  tx.objectStore('pins').put({ ...pin, expiresAt }, pin.id);
  await done;
  pin.expiresAt = expiresAt;
};
export const closeDatabase = async (): Promise<void> => {
  if (opening) { try { (await opening).close(); } catch { /* Failed opens have no handle. */ } }
  opening = undefined;
  versionChanged = false;
};
