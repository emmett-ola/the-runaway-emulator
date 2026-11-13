import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { migrate, migrateWithDiagnostics } from './migrate';
import { loadStore, readRecord, writeRecord, getStorageDiagnostics, readRecoveryStore } from './index';

const legacy = {
  alice: {
    username: 'alice', hits: [{ timestamp: 200 }, { id: 'first', timestamp: 0, date: '1970-01-01', extra: ['keep'] }],
    profile: { email: 'a@example.test', custom: true },
    settings: { games: { cardDropEnabled: true, forkInTheRoadEnabled: true } },
    cardCollections: { '#001': 7 }, custom: { nested: [1] },
  },
};
beforeEach(() => localStorage.clear());
afterEach(() => vi.restoreAllMocks());

describe('v2 migration table', () => {
  it.each([legacy, legacy.alice])('migrates legacy map/single, derives registration and preserves extensions: %j', raw => {
    const result = migrate(raw, 999);
    expect(result.schemaVersion).toBe(2);
    expect(result.users.alice.registeredAt).toBe(0);
    expect(result.users.alice.profile).toEqual({ email: 'a@example.test', custom: true });
    expect(result.users.alice.settings).toEqual(legacy.alice.settings);
    expect(result.users.alice.cardCollections).toEqual({ '#001': 7 });
    expect(result.users.alice.custom).toEqual({ nested: [1] });
    expect(result.users.alice.hits[1]).toEqual({ id: 'first', at: 0, extra: ['keep'] });
    expect(result.users.alice.hits[0].id).toBeTruthy();
    expect(result.users.alice.hits[0].id).toBe(migrate(raw, 1000).users.alice.hits[0].id);
    expect(result.users.alice.hits[0]).not.toHaveProperty('date');
    expect(result.users.alice.hits[0]).not.toHaveProperty('timestamp');
  });
  it('is exactly idempotent for valid v2, including unknown rescue data', () => {
    const store = { schemaVersion: 2 as const, users: { x: { username: 'x', registeredAt: 0, hits: [{ id: 'a', at: 1 }] } }, unknown: { backup: 'original bytes' } };
    expect(migrate(store, 999)).toBe(store);
    expect(migrate(migrate(legacy, 100), 1000)).toEqual(migrate(legacy, 100));
  });
  it.each(['{broken', 'null', '[]', '{"schemaVersion":3,"users":{}}', '{"x":{"username":"x","hits":"bad"}}'])('preserves wrong shape/unreadable bytes without making up users: %s', raw => {
    const result = migrateWithDiagnostics(raw, 123);
    expect(result.store).toMatchObject({ schemaVersion: 2, users: {}, unknown: { backup: raw } });
    expect(result.blocked).toBe(true);
    expect(result.diagnostics.length).toBeGreaterThan(0);
  });
  it('converts date-only hits at local midnight, generates stable unique ids, and never mutates input', () => {
    const raw = { username: 'dates', hits: [{ date: '2024-02-29' }, { date: '2024-02-29' }] };
    const before = JSON.stringify(raw);
    const store = migrate(raw, 1);
    expect(store.users.dates.hits.map(hit => hit.at)).toEqual([new Date(2024, 1, 29).getTime(), new Date(2024, 1, 29).getTime()]);
    expect(new Set(store.users.dates.hits.map(hit => hit.id)).size).toBe(2);
    expect(JSON.stringify(raw)).toBe(before);
    expect(store.users.dates.registeredAt).toBe(new Date(2024, 1, 29).getTime());
  });
  it('drops only unresolvable hits from active history, backs up everything, and reports each drop', () => {
    const raw = JSON.stringify({ username: 'bad', hits: [{ id: 'bad', date: '2024-02-30' }, null, { timestamp: 42 }] });
    const result = migrateWithDiagnostics(raw, 999);
    expect(result.store.users.bad.hits).toHaveLength(1);
    expect(result.store.users.bad.hits[0].at).toBe(42);
    expect(result.store.unknown?.backup).toBe(raw);
    expect(result.diagnostics.filter(d => d.code === 'dropped-hit')).toHaveLength(2);
  });
  it('persists no-history registration once and repairs missing/invalid v2 registration from history', () => {
    expect(migrate({ username: 'empty', hits: [] }, 123).users.empty.registeredAt).toBe(123);
    expect(migrate({ schemaVersion: 2, users: { x: { username: 'x', hits: [{ id: 'a', at: 10 }] } } }, 999).users.x.registeredAt).toBe(10);
    expect(migrate({ username: 'x', hits: [{ timestamp: 10 }], profile: { registrationDate: 'invalid', email: 'keep' } }, 999).users.x).toMatchObject({ registeredAt: 10, profile: { email: 'keep' } });
  });
  it('preserves unrelated record fields named date/timestamp without repeatedly migrating v2', () => {
    const store = { schemaVersion: 2 as const, users: { x: { username: 'x', registeredAt: 1, hits: [], date: 'custom', timestamp: { custom: true } } } };
    expect(migrate(store, 2)).toBe(store);
  });
  it('derives registration for large histories without a spread-argument limit', () => {
    const hits = Array.from({ length: 150000 }, (_, index) => ({ id: String(index), timestamp: index }));
    const result = migrate({ username: 'large', hits }, 999);
    expect(result.users.large.hits).toHaveLength(150000);
    expect(result.users.large.registeredAt).toBe(0);
  });
  it('preserves a known legacy registration even when history disagrees, and surfaces that conflict', () => {
    const result = migrateWithDiagnostics({ username: 'known', profile: { registrationDate: -100, email: 'keep' }, hits: [{ timestamp: 50 }] }, 999);
    expect(result.store.users.known.registeredAt).toBe(-100);
    expect(result.store.users.known.profile).toEqual({ email: 'keep' });
    expect(result.diagnostics.some(d => d.code === 'registration-conflict')).toBe(true);
  });
});

describe('backup-before-write loader', () => {
  it('backs up exact original bytes before rewriting, persists repair once, and preserves credentials', () => {
    const raw = JSON.stringify(legacy, null, 2);
    localStorage.setItem('runawaylog-data', raw);
    localStorage.setItem('runawaylog-credentials', 'opaque credentials');
    const writes = vi.spyOn(Storage.prototype, 'setItem');
    const first = loadStore(123).store;
    expect(writes.mock.calls[0][0]).toBe('runawaylog-data-backups');
    expect(JSON.parse(localStorage.getItem('runawaylog-data-backups')!)).toContain(raw);
    expect(JSON.parse(localStorage.getItem('runawaylog-data')!)).toEqual(first);
    const count = writes.mock.calls.length;
    expect(loadStore(999).store).toEqual(first);
    expect(writes).toHaveBeenCalledTimes(count);
    expect(localStorage.getItem('runawaylog-credentials')).toBe('opaque credentials');
  });
  it.each(['runawaylog-data-backups', 'runawaylog-data'])('blocks writes when %s fails; original user bytes survive', key => {
    const raw = JSON.stringify(legacy);
    localStorage.setItem('runawaylog-data', raw);
    const real = Storage.prototype.setItem;
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (this: Storage, name, value) {
      if (name === key) throw new Error('quota');
      real.call(this, name, value);
    });
    expect(loadStore(123).blocked).toBe(true);
    expect(() => writeRecord({ username: 'new', registeredAt: 123, hits: [] })).toThrow();
    expect(localStorage.getItem('runawaylog-data')).toBe(raw);
    expect(getStorageDiagnostics().some(d => d.code === 'write-blocked')).toBe(true);
  });
  it('never replaces malformed user data, exposes an exportable rescue, and reports diagnostics', () => {
    const raw = '{unreadable full original bytes';
    localStorage.setItem('runawaylog-data', raw);
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(loadStore(1).blocked).toBe(true);
    expect(() => readRecord('new')).toThrow();
    expect(() => writeRecord({ username: 'new', registeredAt: 1, hits: [] })).toThrow();
    expect(localStorage.getItem('runawaylog-data')).toBe(raw);
    expect(readRecoveryStore().unknown?.backup).toBe(raw);
    expect(log).toHaveBeenCalled();
  });
});
