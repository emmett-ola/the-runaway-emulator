import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { LocalStorageAdapter, CloudStorageAdapter } from '../../storage';
import { login, register } from '../../auth';

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

describe('legacy consumer integration', () => {
  it.each([LocalStorageAdapter, CloudStorageAdapter])('%s repairs on load and preserves extras and peers on save/delete', async Adapter => {
    const adapter = new Adapter();
    const loaded = await finish(adapter.loadUserData('old'));
    expect(loaded).toEqual({ ...original().old, profile: { ...original().old.profile, registrationDate: 1234567890000 } });
    await finish(adapter.saveUserData({ ...loaded!, cardCollections: { keep: 3 } }));
    const stored = JSON.parse(localStorage.getItem('runawaylog-data')!);
    expect(stored.old.hits).toEqual(original().old.hits);
    expect(stored.old.unknown).toEqual([1, 2]);
    expect(stored.peer).toEqual(original().peer);
    await finish(adapter.deleteUserData('old'));
    expect(JSON.parse(localStorage.getItem('runawaylog-data')!)).toEqual({ peer: original().peer });
    expect(localStorage.getItem('app-language')).toBe('zh_tw');
  });

  it('login repairs an existing user and new login/register preserve all other users', async () => {
    const old = await finish(login('old', ''));
    expect(old.profile?.registrationDate).toBe(1234567890000);
    expect(old.hits).toEqual(original().old.hits);
    await finish(login('new', ''));
    await finish(register('registered', 'abcdef', 'new@example.test'));
    const stored = JSON.parse(localStorage.getItem('runawaylog-data')!);
    expect(stored.old).toEqual(old);
    expect(stored.peer).toEqual(original().peer);
    expect(stored.new.username).toBe('new');
    expect(stored.registered.profile.email).toBe('new@example.test');
    expect(localStorage.getItem('runawaylog-timezone')).toBe('UTC');
    expect(localStorage.getItem('app-language')).toBe('zh_tw');
  });

  it('auth data writes still reject while adapter writes still swallow failures', async () => {
    const realSet = Storage.prototype.setItem;
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (this: Storage, key, value) {
      if (key === 'runawaylog-data') throw new Error('quota');
      return realSet.call(this, key, value);
    });
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const loginResult = expect(login('new', '')).rejects.toThrow('quota');
    await finish(loginResult);
    const registerResult = expect(register('new', 'abcdef')).rejects.toThrow('quota');
    await finish(registerResult);
    await expect(new LocalStorageAdapter().saveUserData({ username: 'new', hits: [] })).resolves.toBeUndefined();
  });
});
