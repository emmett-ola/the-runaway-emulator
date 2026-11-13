import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { LocalStorageAdapter, CloudStorageAdapter } from '../../storage';
import { login, register, loadCurrentUser } from '../../auth';
import { migrate } from './migrate';
import { readRecord } from './index';

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
  localStorage.setItem('runawaylog-timezone', 'UTC');
  localStorage.setItem('app-language', 'zh_tw');
  localStorage.setItem('runawaylog-data', JSON.stringify(original()));
  vi.useFakeTimers();
});
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

const finish = async <T,>(promise: Promise<T>): Promise<T> => {
  await vi.runAllTimersAsync();
  return promise;
};

describe('v2 consumer integration', () => {
  it.each([LocalStorageAdapter, CloudStorageAdapter])('%s migrates on load and preserves extras and peers on save/delete', async Adapter => {
    const adapter = new Adapter();
    const expected = migrate(original(), Date.now());
    const loaded = await finish(adapter.loadUserData('old'));
    expect(loaded).toEqual(expected.users.old);
    await finish(adapter.saveUserData({ ...loaded!, cardCollections: { keep: 3 } }));
    const stored = JSON.parse(localStorage.getItem('runawaylog-data')!);
    expect(stored.schemaVersion).toBe(2);
    expect(stored.users.old.hits).toEqual([{ id: 'a', at: 1234567890000, extra: ['keep'] }]);
    expect(stored.users.old.unknown).toEqual([1, 2]);
    expect(stored.users.peer).toEqual(expected.users.peer);
    await finish(adapter.deleteUserData('old'));
    expect(JSON.parse(localStorage.getItem('runawaylog-data')!)).toEqual({ ...stored, users: { peer: expected.users.peer } });
    expect(localStorage.getItem('app-language')).toBe('zh_tw');
  });

  it('login recognizes migrated existing users and new login/register preserve all other users', async () => {
    const old = await finish(login('old', ''));
    expect(old.registeredAt).toBe(1234567890000);
    expect(old.hits).toEqual([{ id: 'a', at: 1234567890000, extra: ['keep'] }]);
    expect(JSON.parse(localStorage.getItem('runawaylog-current-user')!)).toEqual({ username: 'old' });
    await new LocalStorageAdapter().addHit('old');
    expect(loadCurrentUser()!.hits).toHaveLength(2);
    await finish(login('new', ''));
    await finish(register('registered', 'abcdef', 'new@example.test'));
    const stored = JSON.parse(localStorage.getItem('runawaylog-data')!);
    expect(stored.users.old).toEqual(readRecord('old'));
    expect(stored.users.old.hits[0]).toEqual(old.hits[0]);
    expect(stored.users.peer).toEqual(migrate(original(), 1).users.peer);
    expect(stored.users.new.username).toBe('new');
    expect(stored.users.registered.profile.email).toBe('new@example.test');
    expect(localStorage.getItem('runawaylog-timezone')).toBe('UTC');
    expect(localStorage.getItem('app-language')).toBe('zh_tw');
  });

  it('auth data writes still reject while adapter saves still report failures without changing bytes', async () => {
    const before = localStorage.getItem('runawaylog-data');
    const realSet = Storage.prototype.setItem;
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (this: Storage, key, value) {
      if (key === 'runawaylog-data') throw new Error('quota');
      return realSet.call(this, key, value);
    });
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    const loginResult = expect(login('new', '')).rejects.toThrow('quota');
    await finish(loginResult);
    const registerResult = expect(register('new', 'abcdef')).rejects.toThrow('quota');
    await finish(registerResult);
    await expect(new LocalStorageAdapter().saveUserData({ username: 'new', registeredAt: 1, hits: [] })).resolves.toBeUndefined();
    expect(await new LocalStorageAdapter().addHit('old')).toBeNull();
    expect(localStorage.getItem('runawaylog-data')).toBe(before);
    expect(log).toHaveBeenCalled();
  });

  it('preserves credential checking, passwordless demo entry, and refuses registration over an existing record', async () => {
    await finish(login('protected', 'secret'));
    const credentials = localStorage.getItem('runawaylog-credentials');
    const wrong = expect(login('protected', 'wrong')).rejects.toThrow('Invalid username or password');
    await finish(wrong);
    expect((await finish(login('protected', 'secret'))).username).toBe('protected');
    expect((await finish(login('protected', ''))).username).toBe('protected');
    const duplicate = expect(register('old', 'abcdef')).rejects.toThrow('Username already exists');
    await finish(duplicate);
    expect(localStorage.getItem('runawaylog-credentials')).toBe(credentials);
    expect(readRecord('old')!.hits).toHaveLength(1);
  });
});
