import { IDBObjectStore } from 'fake-indexeddb';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { LocalStorageAdapter, CloudStorageAdapter } from '../../storage';
import { login, register, loadCurrentUser } from '../../auth';
import { getStorageState, readFullRecord, readRecord, readStore, updatePlugin } from './index';
import { readIdentityCache } from './preferences';
import { seedRecord } from '../../test/storage-fixtures';

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

  it('login recognizes migrated existing users and new login/register preserve all other users', async () => {
    const legacyBytes = localStorage.getItem('runawaylog-data');
    const before = Date.now();
    const old = await login('old', '');
    expect(old.registeredAt).toBeGreaterThanOrEqual(before);
    expect(old.total).toBe(0);
    expect(old).not.toHaveProperty('hits');
    expect(JSON.parse(readIdentityCache('currentUser')!)).toEqual({ username: 'old' });
    await new LocalStorageAdapter().addHit('old');
    expect(loadCurrentUser()!.total).toBe(1);
    const preserved = await readFullRecord('old');
    await login('new', '');
    await register('registered', 'abcdef', 'new@example.test');
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
    await expect(login('new', '')).rejects.toThrow('quota');
    await expect(register('registered', 'abcdef')).rejects.toThrow('quota');
    await expect(updatePlugin((await readRecord('old'))!.accountId, { cardCollections: { keep: 3 } })).rejects.toThrow('quota');
    await expect(new LocalStorageAdapter().addHit('old')).rejects.toThrow('quota');
    expect(getStorageState().revision).toBe(revision);
    vi.restoreAllMocks();
    expect(await readFullRecord('old')).toEqual(before);
    expect(await readRecord('new')).toBeNull();
    expect(await readRecord('registered')).toBeNull();
    expect(localStorage.getItem('runawaylog-data')).toBe(legacyBytes);
  });

  it('preserves credential checking, passwordless demo entry, and refuses registration over an existing record', async () => {
    await seedRecord({ username: 'old', registeredAt: 1, hits: [{ id: 'a', at: 1, schemaVersion: 1, recordVersion: '1' }] });
    await login('protected', 'secret');
    const credentials = readIdentityCache('credentials');
    await expect(login('protected', 'wrong')).rejects.toThrow('Invalid username or password');
    expect((await login('protected', 'secret')).username).toBe('protected');
    expect((await login('protected', '')).username).toBe('protected');
    await expect(register('old', 'abcdef')).rejects.toThrow('Username already exists');
    expect(readIdentityCache('credentials')).toBe(credentials);
    expect((await readFullRecord('old')).hits).toHaveLength(1);
  });
});
