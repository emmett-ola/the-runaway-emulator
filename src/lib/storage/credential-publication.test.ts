import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { login, logout, lookupLocalIdentity, register, setupLocalPassword } from '../../auth';
import { getSessionUsername } from '../../app/session';
import { createAccount, deleteRecord, readCredential, readRecord } from './index';
import { completed, openDatabase, readCurrent, transaction } from './idb';
import { createCredential, toBase64 } from '../identity/password';

const synthetic = () => `SYNTHETIC-FENCE-${crypto.randomUUID()}`;
const deferred = () => {
  let resolve!: () => void;
  const promise = new Promise<void>(done => { resolve = done; });
  return { promise, resolve };
};
beforeEach(() => { sessionStorage.clear(); });
afterEach(() => { vi.restoreAllMocks(); });
describe('credential publication and session completion fences', () => {
  it('waits for the final transaction completion callback before session entry or setup resolution', async () => {
    const db = await openDatabase(), real = db.transaction.bind(db), reached = deferred();
    let release: (() => void) | undefined, settled = false;
    const spy = vi.spyOn(db, 'transaction').mockImplementation((...args: Parameters<IDBDatabase['transaction']>) => {
      const tx = real(...args);
      if (args[1] === 'readwrite') {
        const store = tx.objectStore('control'), put = store.put.bind(store);
        let final = false;
        vi.spyOn(store, 'put').mockImplementation((...putArgs: Parameters<IDBObjectStore['put']>) => { if (putArgs[1] === 'current') final = true; return put(...putArgs); });
        Object.defineProperty(tx, 'oncomplete', { configurable: true, set(handler: ((event: Event) => void) | null) {
          tx.addEventListener('complete', event => {
            if (final) { release = () => handler?.call(tx, event); reached.resolve(); }
            else handler?.call(tx, event);
          }, { once: true });
        } });
      }
      return tx;
    });
    const password = synthetic(), identity = await lookupLocalIdentity('completion');
    const pending = setupLocalPassword(identity, password, password).then(() => { settled = true; });
    try {
      await reached.promise;
      expect(settled).toBe(false);
      expect(getSessionUsername()).toBeNull();
      expect(await readCurrent()).not.toBeNull();
      expect(await readRecord('completion')).not.toBeNull();
    } finally { release?.(); await pending; spy.mockRestore(); }
    expect(settled).toBe(true);
    expect(getSessionUsername()).toBe('completion');
  });
  it('aborts predecessor setup without a credential or changed identity and then retries safely', async () => {
    const id = (await createAccount('old-fence')).accountId!, before = await readCurrent();
    const db = await openDatabase(), real = db.transaction.bind(db);
    const spy = vi.spyOn(db, 'transaction').mockImplementation((...args: Parameters<IDBDatabase['transaction']>) => {
      const tx = real(...args);
      if (args[1] === 'readwrite') {
        const store = tx.objectStore('credentials'), put = store.put.bind(store);
        vi.spyOn(store, 'put').mockImplementation((...putArgs: Parameters<IDBObjectStore['put']>) => {
          const operation = put(...putArgs); operation.addEventListener('success', () => tx.abort(), { once: true }); return operation;
        });
      }
      return tx;
    });
    const password = synthetic(), identity = await lookupLocalIdentity('old-fence');
    await expect(setupLocalPassword(identity, password, password)).rejects.toThrow();
    spy.mockRestore();
    expect(await readCurrent()).toEqual(before);
    expect((await readRecord('old-fence'))?.accountId).toBe(id);
    expect(await readCredential(id)).toBeNull();
    expect(getSessionUsername()).toBeNull();
    expect((await setupLocalPassword(identity, password, password)).accountId).toBe(id);
  });
  it('rejects an actual upgrade race after derivation without overwriting the concurrent credential or entering a session', async () => {
    const password = synthetic(), account = await register('upgrade-fence', password), original = (await readCredential(account.accountId))!;
    const salt = Uint8Array.from(atob(original.saltB64), value => value.charCodeAt(0));
    const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
    const hash = new Uint8Array(await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: 1 }, key, 256));
    const tx = transaction(await openDatabase(), 'readwrite'), done = completed(tx);
    tx.objectStore('credentials').put({ ...original, iterations: 1, hashB64: toBase64(hash) }, account.accountId); await done;
    const replacement = await createCredential(synthetic()), reached = deferred(), release = deferred();
    const derive = crypto.subtle.deriveBits.bind(crypto.subtle);
    const spy = vi.spyOn(crypto.subtle, 'deriveBits').mockImplementation(async (...args: Parameters<SubtleCrypto['deriveBits']>) => {
      const result = await derive(...args);
      if ((args[0] as Pbkdf2Params).iterations === 210_000) { reached.resolve(); await release.promise; }
      return result;
    });
    logout();
    const pending = login('upgrade-fence', password);
    try {
      await reached.promise;
      const rewrite = transaction(await openDatabase(), 'readwrite'), completedRewrite = completed(rewrite);
      rewrite.objectStore('credentials').put(replacement, account.accountId); await completedRewrite;
    } finally { release.resolve(); }
    await expect(pending).rejects.toMatchObject({ code: 'identity_changed' });
    spy.mockRestore();
    expect((await readCredential(account.accountId))?.hashB64 === replacement.hashB64).toBe(true);
    expect(getSessionUsername()).toBeNull();
  });
  it('does not rewrite a current-parameter credential and deletes credentials only with account deletion publication', async () => {
    const password = synthetic(), first = await register('delete-first', password), second = await register('delete-second', synthetic());
    const old = (await readCredential(first.accountId))!, db = await openDatabase(), real = db.transaction.bind(db);
    let writes = 0;
    const spy = vi.spyOn(db, 'transaction').mockImplementation((...args: Parameters<IDBDatabase['transaction']>) => {
      const tx = real(...args);
      if (args[1] === 'readwrite') {
        const store = tx.objectStore('credentials'), put = store.put.bind(store);
        vi.spyOn(store, 'put').mockImplementation((...putArgs: Parameters<IDBObjectStore['put']>) => { writes++; return put(...putArgs); });
      }
      return tx;
    });
    await login('delete-first', password);
    expect(writes).toBe(0);
    expect((await readCredential(first.accountId))?.updatedAt).toBe(old.updatedAt);
    await deleteRecord(first.accountId);
    spy.mockRestore();
    expect(await readRecord(first.accountId)).toBeNull();
    expect(await readCredential(first.accountId)).toBeNull();
    expect(await readCredential(second.accountId)).not.toBeNull();
  });
});
