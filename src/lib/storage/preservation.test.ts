import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createAccount, getStorageDiagnostics, getStorageState, initializeStorage, readFullRecord, readRecord, readStore, renameAccount, resetStorage, updateProfile } from './index';
import { readIdentityCache, writeIdentityCache } from './preferences';
import { seedRecord } from '../../test/storage-fixtures';

afterEach(() => vi.restoreAllMocks());
beforeEach(() => { localStorage.clear(); sessionStorage.clear(); });
describe('preservation edge cases', () => {
  it('does not change a persisted registration when an otherwise valid update changes it', async () => {
    await seedRecord({ username: 'x', registeredAt: 1, hits: [] });
    const before = await readRecord('x');
    await updateProfile(before!.accountId, { email: 'updated@example.test', registeredAt: 2 });
    await renameAccount(before!.accountId, 'renamed');
    await resetStorage();
    await initializeStorage();
    expect(await readRecord('x')).toBeNull();
    expect(await readRecord('renamed')).toMatchObject({ accountId: before!.accountId, registeredAt: 1, profile: { email: 'updated@example.test', registeredAt: 2 } });
    expect((await readFullRecord('renamed')).registeredAt).toBe(1);
  });
  it('reports saved dropped-hit diagnostics on subsequent loads as well as the first migration', async () => {
    const raw = '{"x":{"username":"x","hits":[null]}}';
    localStorage.setItem('runawaylog-data', raw);
    const reads = vi.spyOn(Storage.prototype, 'getItem');
    for (let boot = 0; boot < 2; boot++) {
      await resetStorage();
      await initializeStorage();
      expect(await readStore()).toEqual({ schemaVersion: 2, users: {} });
      expect(getStorageDiagnostics()).toEqual([]);
    }
    expect(reads.mock.calls.some(([key]) => key === 'runawaylog-data')).toBe(false);
    expect(localStorage.getItem('runawaylog-data')).toBe(raw);
  });
  it('archives old full identity mirrors before reducing them to identity-only data', () => {
    const raw = '{ "username": "x", "hits": [], "unknown": { "rescue": true } }';
    localStorage.setItem('runawaylog-current-user', raw);
    writeIdentityCache('currentUser', '{"username":"x"}');
    expect(readIdentityCache('currentUser')).toBe('{"username":"x"}');
    expect(localStorage.getItem('runawaylog-current-user')).toBe(raw);
    expect(localStorage.getItem('runawaylog-current-user-backups')).toBeNull();
  });
  it('leaves the old identity mirror intact if its backup fails', () => {
    const raw = '{"username":"x","hits":[],"unknown":1}';
    localStorage.setItem('runawaylog-current-user', raw);
    const real = Storage.prototype.setItem;
    const writes = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (this: Storage, key, value) {
      if (key === 'runawaylog-current-user-backups') throw new Error('quota');
      real.call(this, key, value);
    });
    expect(() => writeIdentityCache('currentUser', '{"username":"x"}')).not.toThrow();
    expect(readIdentityCache('currentUser')).toBe('{"username":"x"}');
    expect(writes.mock.calls.some(([key]) => key === 'runawaylog-current-user-backups')).toBe(false);
    expect(localStorage.getItem('runawaylog-current-user')).toBe(raw);
  });
  it('does not overwrite malformed recovery archives or a mixed valid/invalid user map', async () => {
    const raw = '{"valid":{"username":"valid","hits":[]},"bad":{"hits":false}}';
    localStorage.setItem('runawaylog-data', raw);
    localStorage.setItem('runawaylog-data-backups', 'unreadable existing archive');
    await resetStorage();
    await initializeStorage();
    expect(getStorageState().status).toBe('ready');
    expect(await readStore()).toEqual({ schemaVersion: 2, users: {} });
    await expect(createAccount('new')).resolves.toHaveProperty('accountId');
    expect(localStorage.getItem('runawaylog-data')).toBe(raw);
    expect(localStorage.getItem('runawaylog-data-backups')).toBe('unreadable existing archive');
    expect(await readRecord('valid')).toBeNull();
    expect(await readRecord('bad')).toBeNull();
  });
});
