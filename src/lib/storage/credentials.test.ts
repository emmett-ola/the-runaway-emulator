import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { login, logout, lookupLocalIdentity, register, setupLocalPassword } from '../../auth';
import { getSessionUsername } from '../../app/session';
import { appendHit, createAccount, getStorageState, readCredential, readFullRecord, readRecord, readStore, writeAccountCredential } from './index';
import { completed, getGeneration, openDatabase, readCurrent, request, transaction } from './idb';
import { createCredential, PASSWORD_ALGORITHM, PASSWORD_ITERATIONS, toBase64, validateCredential, validatePassword } from '../identity/password';
import { createExportDocument, importUserData, confirmImportedData } from '../data/transfer';
import { unzipSync } from 'fflate';

const synthetic = () => `SYNTHETIC-ONLY-${crypto.randomUUID()}`;
const setup = async (handle: string, password = synthetic()) => ({ account: await setupLocalPassword(await lookupLocalIdentity(handle), password, password), password });
const putCredential = async (id: string, value: unknown) => {
  const tx = transaction(await openDatabase(), 'readwrite'), done = completed(tx);
  tx.objectStore('credentials').put(value, id);
  await done;
};
const allCredentialKeys = async () => {
  const tx = transaction(await openDatabase(), 'readonly'), done = completed(tx);
  const keys = await request(tx.objectStore('credentials').getAllKeys());
  await done;
  return keys;
};
beforeEach(() => { sessionStorage.clear(); localStorage.clear(); });
afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers(); });

describe('local password identity owning layer', () => {
  it('looks up exact handles as missing, credentialless and credentialed without UUID aliases', async () => {
    expect(await lookupLocalIdentity('missing')).toEqual({ username: 'missing', accountId: null, step: 'setup' });
    const id = (await createAccount('prior')).accountId!;
    expect(await lookupLocalIdentity('prior')).toEqual({ username: 'prior', accountId: id, step: 'setup' });
    expect((await lookupLocalIdentity(id)).accountId).toBeNull();
    await setup('prior');
    expect(await lookupLocalIdentity('prior')).toEqual({ username: 'prior', accountId: id, step: 'password' });
    await expect(lookupLocalIdentity(' ')).rejects.toMatchObject({ code: 'username_required' });
  });
  it('verifies correct passwords, rejects wrong and empty, and exposes no public passwordless creation bypass', async () => {
    await expect(login('absent', '')).rejects.toMatchObject({ code: 'setup_required' });
    expect(await readRecord('absent')).toBeNull();
    const { account, password } = await setup('verify');
    logout();
    await expect(login('verify', 'SYNTHETIC-WRONG')).rejects.toMatchObject({ code: 'invalid_credentials' });
    await expect(login('verify', '')).rejects.toMatchObject({ code: 'invalid_credentials' });
    expect(getSessionUsername()).toBeNull();
    expect((await login('verify', password)).accountId).toBe(account.accountId);
    const credential = (await readCredential(account.accountId))!;
    expect(Object.keys(credential).sort()).toEqual(['algorithm', 'iterations', 'saltB64', 'hashB64', 'createdAt', 'updatedAt'].sort());
    expect(credential.iterations).toBe(PASSWORD_ITERATIONS);
    expect(credential.algorithm).toBe(PASSWORD_ALGORITHM);
  });
  it.each([
    ['password_too_short', () => 'x'.repeat(11), (p: string) => p],
    ['password_too_long', () => '界'.repeat(342), (p: string) => p],
    ['password_invalid_unicode', () => 'x'.repeat(12) + '\ud800', (p: string) => p],
    ['password_invalid_unicode', () => 'x'.repeat(12), () => '\udc00'],
    ['confirmation_mismatch', () => synthetic(), () => synthetic()],
  ] as const)('rejects policy reason %s without any partial creation', async (code, make, confirmation) => {
    const password = make();
    await expect(setupLocalPassword(await lookupLocalIdentity('policy'), password, confirmation(password))).rejects.toMatchObject({ code });
    expect(await readRecord('policy')).toBeNull();
    expect(await allCredentialKeys()).toHaveLength(0);
    expect(await readCurrent()).toBeNull();
  });
  it('counts Unicode code points and exact UTF-8 byte limits without normalization, truncation or composition', async () => {
    expect(() => validatePassword('😀'.repeat(12))).not.toThrow();
    expect(() => validatePassword('a'.repeat(1024))).not.toThrow();
    expect(() => validatePassword('😀'.repeat(256))).not.toThrow();
    expect(() => validatePassword('a'.repeat(1025))).toThrow();
    const password = '  ' + 'é'.repeat(12) + '  ';
    await setup('exact', password);
    logout();
    await expect(login('exact', password.normalize('NFC'))).rejects.toMatchObject({ code: 'invalid_credentials' });
    await expect(login('exact', password.trim())).rejects.toMatchObject({ code: 'invalid_credentials' });
    expect((await login('exact', password)).username).toBe('exact');
  });
  it('preserves predecessor identity, registration and data through absent-record password setup', async () => {
    const id = (await createAccount('predecessor')).accountId!;
    await appendHit(id, { id: 'retained', at: 1, schemaVersion: 1, recordVersion: '1' });
    const before = await readFullRecord(id);
    await expect(login('predecessor', '')).rejects.toMatchObject({ code: 'setup_required' });
    const { account } = await setup('predecessor');
    expect(account.accountId).toBe(id);
    expect(await readFullRecord(id)).toEqual(before);
    expect(await readCredential(id)).not.toBeNull();
  });
  it('enforces five failures and the exact 30-second boundary, preserving cooldown across logout and lookup', async () => {
    const { password } = await setup('cooldown');
    logout();
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(2_000_000);
    for (let count = 1; count <= 5; count++) {
      await expect(login('cooldown', 'SYNTHETIC-WRONG')).rejects.toMatchObject({ code: count === 5 ? 'cooldown' : 'invalid_credentials' });
    }
    logout(); await lookupLocalIdentity('cooldown');
    await expect(login('cooldown', password)).rejects.toMatchObject({ code: 'cooldown' });
    vi.setSystemTime(2_029_999);
    await expect(login('cooldown', password)).rejects.toMatchObject({ code: 'cooldown' });
    vi.setSystemTime(2_030_000);
    expect((await login('cooldown', password)).username).toBe('cooldown');
    for (let count = 1; count <= 4; count++) await expect(login('cooldown', 'SYNTHETIC-WRONG')).rejects.toMatchObject({ code: 'invalid_credentials' });
    expect((await login('cooldown', password)).username).toBe('cooldown');
    await expect(login('cooldown', 'SYNTHETIC-WRONG')).rejects.toMatchObject({ code: 'invalid_credentials' });
  });
  it('expires cooldown into a fresh failure counter without deriving during blocked attempts', async () => {
    const { password } = await setup('expiry-counter');
    logout();
    vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(3_000_000);
    for (let count = 1; count <= 5; count++) await expect(login('expiry-counter', 'SYNTHETIC-WRONG')).rejects.toMatchObject({ code: count === 5 ? 'cooldown' : 'invalid_credentials' });
    const derive = vi.spyOn(crypto.subtle, 'deriveBits');
    vi.setSystemTime(3_029_999);
    await expect(login('expiry-counter', password)).rejects.toMatchObject({ code: 'cooldown' });
    expect(derive).not.toHaveBeenCalled();
    vi.setSystemTime(3_030_000);
    await expect(login('expiry-counter', 'SYNTHETIC-WRONG')).rejects.toMatchObject({ code: 'invalid_credentials' });
    expect(derive).toHaveBeenCalledOnce();
    expect((await login('expiry-counter', password)).username).toBe('expiry-counter');
  });
  it('isolates cooldown by account and serializes concurrent verification attempts', async () => {
    const a = await setup('cool-a'), b = await setup('cool-b');
    logout();
    const results = await Promise.allSettled(Array.from({ length: 6 }, () => login('cool-a', 'SYNTHETIC-WRONG')));
    expect(results.every(result => result.status === 'rejected')).toBe(true);
    expect(results.map(result => result.status === 'rejected' ? result.reason.code : '')).toEqual(['invalid_credentials', 'invalid_credentials', 'invalid_credentials', 'invalid_credentials', 'cooldown', 'cooldown']);
    expect((await login('cool-b', b.password)).accountId).toBe(b.account.accountId);
    await expect(login('cool-a', a.password)).rejects.toMatchObject({ code: 'cooldown' });
  });
  it('upgrades a real weaker PBKDF2 record with the same salt and preserved creation time before entering', async () => {
    const { account, password } = await setup('upgrade');
    const original = (await readCredential(account.accountId))!;
    const salt = Uint8Array.from(atob(original.saltB64), ch => ch.charCodeAt(0));
    const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
    const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: 2 }, key, 256);
    const old = { ...original, iterations: 2, hashB64: toBase64(new Uint8Array(bits)) };
    await putCredential(account.accountId, old);
    logout();
    expect((await login('upgrade', password)).accountId).toBe(account.accountId);
    const next = (await readCredential(account.accountId))!;
    expect(next.iterations).toBe(PASSWORD_ITERATIONS);
    expect(next.saltB64 === old.saltB64).toBe(true);
    expect(next.hashB64 !== old.hashB64).toBe(true);
    expect(next.createdAt).toBe(old.createdAt);
    expect(next.updatedAt).toBeGreaterThan(old.updatedAt);
  });
  it('guards a concurrent credential rewrite and never overwrites the newer record', async () => {
    const { account, password } = await setup('guard');
    const old = (await readCredential(account.accountId))!;
    const replacement = await createCredential(synthetic());
    await putCredential(account.accountId, replacement);
    logout();
    await expect(writeAccountCredential(account.accountId, account.username, old, await createCredential(password, old))).rejects.toMatchObject({ code: 'identity_changed' });
    expect((await readCredential(account.accountId))?.hashB64 === replacement.hashB64).toBe(true);
    expect(getSessionUsername()).toBeNull();
  });
  it('rejects malformed records before PBKDF2 and never offers setup or overwrites them', async () => {
    const { account } = await setup('malformed');
    const valid = (await readCredential(account.accountId))!;
    const invalid = [undefined, null, {}, { ...valid, iterations: 0 }, { ...valid, iterations: PASSWORD_ITERATIONS + 1 }, { ...valid, algorithm: 'unsupported' },
      { ...valid, saltB64: 'x'.repeat(24) }, { ...valid, hashB64: 'x'.repeat(44) }, { ...valid, accountId: account.accountId }, { ...valid, updatedAt: -1 }];
    logout();
    const derive = vi.spyOn(crypto.subtle, 'deriveBits');
    for (const value of invalid) {
      await putCredential(account.accountId, value);
      await expect(lookupLocalIdentity('malformed')).rejects.toMatchObject({ code: 'credential_invalid' });
      await expect(login('malformed', synthetic())).rejects.toMatchObject({ code: 'credential_invalid' });
    }
    expect(derive).not.toHaveBeenCalled();
    expect(getSessionUsername()).toBeNull();
    expect(() => validateCredential({ ...valid, iterations: 1.5 })).toThrow();
  });
  it('aborts new identity and credential together after pointer put success and permits a safe retry', async () => {
    const db = await openDatabase(), realTransaction = db.transaction.bind(db);
    const spy = vi.spyOn(db, 'transaction').mockImplementation((...args: Parameters<IDBDatabase['transaction']>) => {
      const tx = realTransaction(...args);
      if (args[1] === 'readwrite') {
        const store = tx.objectStore('control'), realPut = store.put.bind(store);
        vi.spyOn(store, 'put').mockImplementation((...putArgs: Parameters<IDBObjectStore['put']>) => {
          const operation = realPut(...putArgs);
          if (putArgs[1] === 'current') operation.addEventListener('success', () => tx.abort(), { once: true });
          return operation;
        });
      }
      return tx;
    });
    await expect(setup('aborted')).rejects.toThrow();
    spy.mockRestore();
    expect(await readCurrent()).toBeNull();
    expect(await readRecord('aborted')).toBeNull();
    expect(await allCredentialKeys()).toHaveLength(0);
    expect(getSessionUsername()).toBeNull();
    expect(getStorageState().revision).toBe('0');
    await setup('aborted');
    expect(await allCredentialKeys()).toHaveLength(1);
  });
  it('rejects competing same-handle setup without overwriting or entering as the winning account', async () => {
    const identity = await lookupLocalIdentity('race');
    const one = synthetic(), two = synthetic();
    const outcomes = await Promise.allSettled([setupLocalPassword(identity, one, one), setupLocalPassword(identity, two, two)]);
    expect(outcomes.filter(value => value.status === 'fulfilled')).toHaveLength(1);
    expect(outcomes.filter(value => value.status === 'rejected').every(value => value.status === 'rejected' && value.reason.code === 'identity_changed')).toBe(true);
    expect(await allCredentialKeys()).toHaveLength(1);
    expect(Object.keys((await readStore()).users)).toEqual(['race']);
    const winner = outcomes.findIndex(value => value.status === 'fulfilled');
    logout();
    await expect(login('race', winner === 0 ? two : one)).rejects.toMatchObject({ code: 'invalid_credentials' });
    expect(getSessionUsername()).toBeNull();
    expect((await login('race', winner === 0 ? one : two)).username).toBe('race');
  });
  it('stores identity only per tab and asks again in a fresh tab session while retaining device credentials', async () => {
    const { account, password } = await setup('session');
    expect(getSessionUsername()).toBe('session');
    expect(Object.keys(sessionStorage).sort()).toEqual(['runawaylog-v2-session-currentUser', 'runawaylog-v2-session-username']);
    const values = Object.values(sessionStorage).join('');
    const credential = (await readCredential(account.accountId))!;
    expect([password, credential.saltB64, credential.hashB64].every(value => !values.includes(value))).toBe(true);
    sessionStorage.clear();
    expect(getSessionUsername()).toBeNull();
    expect((await lookupLocalIdentity('session')).step).toBe('password');
    await expect(login('session', '')).rejects.toMatchObject({ code: 'invalid_credentials' });
  });
  it('does not count rejected oversized or malformed verification inputs as failed derivations', async () => {
    const { password } = await setup('bounded-input');
    logout();
    const derive = vi.spyOn(crypto.subtle, 'deriveBits');
    for (let count = 0; count < 6; count++) {
      await expect(login('bounded-input', 'x'.repeat(1025))).rejects.toMatchObject({ code: 'invalid_credentials' });
      await expect(login('bounded-input', '\ud800')).rejects.toMatchObject({ code: 'invalid_credentials' });
    }
    expect(derive).not.toHaveBeenCalled();
    expect((await login('bounded-input', password)).username).toBe('bounded-input');
  });
  it('decodes actual exported ZIP entries proving no credential/password/session data in tree or manifest and imports only into a password-created target', async () => {
    const { account, password } = await setup('archive-source');
    await appendHit(account.accountId, { id: 'archive-hit', at: 1, schemaVersion: 1, recordVersion: '1' });
    const record = (await readCredential(account.accountId))!;
    const zip = await createExportDocument('archive-source'), entries = unzipSync(zip);
    expect(Object.keys(entries).every(path => !/credential|session|password/i.test(path))).toBe(true);
    for (const bytes of Object.values(entries)) {
      const text = new TextDecoder().decode(bytes);
      expect([password, record.saltB64, record.hashB64, 'saltB64', 'hashB64', PASSWORD_ALGORITHM, 'accessToken', 'refreshToken'].every(value => !text.includes(value))).toBe(true);
    }
    const pointer = (await readCurrent())!, generation = await getGeneration(pointer.generation);
    expect(Object.keys(generation.map).some(path => /credential|password|session/i.test(path))).toBe(false);
    const imported = await importUserData(new File([new Uint8Array(zip)], 'synthetic.zip'));
    const missing = crypto.randomUUID();
    await expect(confirmImportedData(missing, imported, 'merge')).rejects.toThrow();
    const target = await register('archive-target', synthetic());
    const before = (await readCredential(target.accountId))!;
    await confirmImportedData(target.accountId, imported, 'merge');
    expect((await readFullRecord(target.accountId)).hits.map(hit => hit.id)).toEqual(['archive-hit']);
    expect((await readCredential(target.accountId))?.hashB64 === before.hashB64).toBe(true);
    expect(await allCredentialKeys()).toHaveLength(2);
  });
});
