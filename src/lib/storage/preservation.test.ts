import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { writeRecord, loadStore, readRecoveryStore } from './index';
import { writeIdentityCache } from './preferences';

afterEach(() => vi.restoreAllMocks());
beforeEach(() => localStorage.clear());
describe('preservation edge cases', () => {
  it('does not change a persisted registration when an otherwise valid update changes it', () => {
    writeRecord({ username: 'x', registeredAt: 1, hits: [] });
    const before = localStorage.getItem('runawaylog-data');
    expect(() => writeRecord({ username: 'x', registeredAt: 2, hits: [] })).toThrow();
    expect(localStorage.getItem('runawaylog-data')).toBe(before);
  });
  it('reports saved dropped-hit diagnostics on subsequent loads as well as the first migration', () => {
    localStorage.setItem('runawaylog-data', '{"x":{"username":"x","hits":[null]}}');
    vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(loadStore(1).diagnostics.some(d => d.code === 'dropped-hit')).toBe(true);
    expect(loadStore(2).diagnostics.some(d => d.code === 'dropped-hit')).toBe(true);
  });
  it('archives old full identity mirrors before reducing them to identity-only data', () => {
    const raw = '{ "username": "x", "hits": [], "unknown": { "rescue": true } }';
    localStorage.setItem('runawaylog-current-user', raw);
    writeIdentityCache('currentUser', '{"username":"x"}');
    expect(localStorage.getItem('runawaylog-current-user')).toBe('{"username":"x"}');
    expect(localStorage.getItem('runawaylog-current-user-backups')).toContain(JSON.stringify(raw).slice(1, -1));
    expect(JSON.stringify(readRecoveryStore())).toContain('rescue');
  });
  it('leaves the old identity mirror intact if its backup fails', () => {
    const raw = '{"username":"x","hits":[],"unknown":1}';
    localStorage.setItem('runawaylog-current-user', raw);
    const real = Storage.prototype.setItem;
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (this: Storage, key, value) {
      if (key === 'runawaylog-current-user-backups') throw new Error('quota');
      real.call(this, key, value);
    });
    expect(() => writeIdentityCache('currentUser', '{"username":"x"}')).toThrow('quota');
    expect(localStorage.getItem('runawaylog-current-user')).toBe(raw);
  });
  it('does not overwrite malformed recovery archives or a mixed valid/invalid user map', () => {
    const raw = '{"valid":{"username":"valid","hits":[]},"bad":{"hits":false}}';
    localStorage.setItem('runawaylog-data', raw);
    localStorage.setItem('runawaylog-data-backups', 'unreadable existing archive');
    vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(loadStore().blocked).toBe(true);
    expect(() => writeRecord({ username: 'new', registeredAt: 1, hits: [] })).toThrow();
    expect(localStorage.getItem('runawaylog-data')).toBe(raw);
    expect(localStorage.getItem('runawaylog-data-backups')).toBe('unreadable existing archive');
  });
});
