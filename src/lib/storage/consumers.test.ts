import { IDBObjectStore } from 'fake-indexeddb';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { LocalStorageAdapter, CloudStorageAdapter } from '../../storage';
import { login, register, loadCurrentUser, lookupLocalIdentity, setupLocalPassword } from '../../auth';
import { getStorageState, readCredential, readFullRecord, readRecord, readStore, updatePlugin } from './index';
import { readIdentityCache } from './preferences';
import { seedRecord } from '../../test/storage-fixtures';

const syntheticPassword = () => `SYNTHETIC-ONLY-${crypto.randomUUID()}`;
const setup = async (handle: string) => {
  const password = syntheticPassword();
  return setupLocalPassword(await lookupLocalIdentity(handle), password, password);
};
const original = () => ({
  old: {
    username: 'old',
    hits: [{ id: 'a', timestamp: 1234567890000, date: '2009-02-13', extra: ['keep'] }],
    profile: { email: 'keep@example.test', unknown: { keep: true } },
    settings: { theme: 'keep' },
    unknown: [1, 2],
  },
  peer: { username: 'peer', hits: [], profile: { registrationDate: 7 }, unknown: true },
});

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  localStorage.setItem('runawaylog-timezone', 'UTC');
  localStorage.setItem('app-language', 'zh_tw');
  localStorage.setItem('runawaylog-data', JSON.stringify(original()));
});
afterEach(() => { vi.restoreAllMocks(); });

describe('v2 consumer integration', () => {
  it.each([LocalStorageAdapter, CloudStorageAdapter])('%s migrates on load and preserves extras and peers on save/delete', async Adapter => {
    const adapter = new Adapter();
    const legacyBytes = localStorage.getItem('runawaylog-data');
    expect(await adapter.loadUserData('old')).toBeNull();
    await seedRecord({ username: 'old', registeredAt: 1234567890000, hits: [{ id: 'a', at: 1234567890000, schemaVersion: 1, recordVersion: '1', extra: ['keep'] }], profile: { email: 'keep@example.test', unknown: { keep: true } }, unknown: [1, 2] });
    await seedRecord({ username: 'peer', registeredAt: 7, hits: [], unknown: true });
    const peer = await readFullRecord('peer');
    const loaded = await adapter.loadUserData('old');
    expect(loaded).toMatchObject({ username: 'old', total: 1, registeredAt: 1234567890000 });
    expect(loaded).not.toHaveProperty('hits');
    await updatePlugin(loaded!.accountId, { cardCollections: { keep: 3 } });
    const stored = await readFullRecord('old');
    expect(stored.hits).toEqual([{ id: 'a', at: 1234567890000, schemaVersion: 1, recordVersion: '1', extra: ['keep'] }]);
    expect(stored.unknown).toEqual([1, 2]);
    expect(stored.cardCollections).toEqual({ keep: 3 });
    expect(await readFullRecord('peer')).toEqual(peer);
    await adapter.deleteUserData('old');
    expect(await adapter.loadUserData('old')).toBeNull();
    expect((await readStore()).users).toEqual({ peer: await readRecord('peer') });
    expect(await readFullRecord('peer')).toEqual(peer);
    expect(localStorage.getItem('runawaylog-data')).toBe(legacyBytes);
    expect(localStorage.getItem('app-language')).toBe('zh_tw');
  });

  it('password setup recognizes current local accounts and new setup/register preserve all other users', async () => {
    const legacyBytes = localStorage.getItem('runawaylog-data');
    const before = Date.now();
    const old = await setup('old');
    expect(old.registeredAt).toBeGreaterThanOrEqual(before);
    expect(old.total).toBe(0);
    expect(old).not.toHaveProperty('hits');
    expect(JSON.parse(readIdentityCache('currentUser')!)).toEqual({ username: 'old' });
    await new LocalStorageAdapter().addHit('old');
    expect(loadCurrentUser()!.total).toBe(1);
    const preserved = await readFullRecord('old');
    await setup('new');
    await register('registered', syntheticPassword(), 'new@example.test');
    expect(await readFullRecord('old')).toEqual(preserved);
    const stored = await readStore();
    expect(stored.users.old).toEqual(await readRecord('old'));
    expect(stored.users.peer).toBeUndefined();
    expect(stored.users.new.username).toBe('new');
    expect(stored.users.registered.profile!.email).toBe('new@example.test');
    expect(localStorage.getItem('runawaylog-data')).toBe(legacyBytes);
    expect(localStorage.getItem('runawaylog-timezone')).toBe('UTC');
    expect(localStorage.getItem('app-language')).toBe('zh_tw');
  });

  it('auth data writes still reject while adapter saves still report failures without changing bytes', async () => {
    await seedRecord({ username: 'old', registeredAt: 1, hits: [{ id: 'a', at: 1, schemaVersion: 1, recordVersion: '1' }] });
    const before = await readFullRecord('old');
    const revision = getStorageState().revision;
    const legacyBytes = localStorage.getItem('runawaylog-data');
    vi.spyOn(IDBObjectStore.prototype, 'put').mockImplementation(() => { throw new DOMException('quota', 'QuotaExceededError'); });
    await expect(setup('new')).rejects.toThrow('quota');
    await expect(register('registered', syntheticPassword())).rejects.toThrow('quota');
    await expect(updatePlugin((await readRecord('old'))!.accountId, { cardCollections: { keep: 3 } })).rejects.toThrow('quota');
    await expect(new LocalStorageAdapter().addHit('old')).rejects.toThrow('quota');
    expect(getStorageState().revision).toBe(revision);
    vi.restoreAllMocks();
    expect(await readFullRecord('old')).toEqual(before);
    expect(await readRecord('new')).toBeNull();
    expect(await readRecord('registered')).toBeNull();
    expect(localStorage.getItem('runawaylog-data')).toBe(legacyBytes);
  });

  it('requires credential verification even for empty passwords and refuses registration over an existing record', async () => {
    await seedRecord({ username: 'old', registeredAt: 1, hits: [{ id: 'a', at: 1, schemaVersion: 1, recordVersion: '1' }] });
    const password = syntheticPassword();
    const account = await register('protected', password);
    const credential = await readCredential(account.accountId);
    await expect(login('protected', 'SYNTHETIC-WRONG')).rejects.toMatchObject({ code: 'invalid_credentials' });
    expect((await login('protected', password)).username).toBe('protected');
    await expect(login('protected', '')).rejects.toMatchObject({ code: 'invalid_credentials' });
    await expect(register('old', syntheticPassword())).rejects.toMatchObject({ code: 'identity_changed' });
    expect(JSON.stringify(await readCredential(account.accountId)) === JSON.stringify(credential)).toBe(true);
    expect((await readFullRecord('old')).hits).toHaveLength(1);
  });
});
