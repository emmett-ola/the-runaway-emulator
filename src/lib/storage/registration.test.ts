import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { migrate } from './migrate';
import { readStore, readRecord, writeRecord } from './index';

describe('v2 registration repair', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => vi.restoreAllMocks());

  it('uses the earliest finite instant and preserves all non-legacy fields and original history in backup', () => {
    const record = {
      username: 'old',
      hits: [
        { id: 'later', timestamp: 200, date: 'frozen', extra: ['keep'] },
        { id: 'invalid', timestamp: NaN, date: 'also-frozen' },
        { id: 'first', timestamp: 0, date: '1970-01-01' },
        { id: 'infinite', timestamp: Infinity, date: 'keep' },
      ],
      profile: { email: 'old@example.test', extra: { keep: true } },
      extra: { nested: ['untouched'] },
    };
    const result = migrate(record, 900);
    expect(result.users.old).toEqual({ username: 'old', registeredAt: 0, hits: [{ id: 'later', at: 200, extra: ['keep'] }, { id: 'first', at: 0 }], profile: record.profile, extra: record.extra });
    expect(result.unknown?.backup).toBe(record);
    expect(record.profile).not.toHaveProperty('registrationDate');
    expect(record.hits).toHaveLength(4);
  });

  it('uses now for empty or non-finite history and preserves existing dates idempotently', () => {
    for (const hits of [[], [{ id: 'bad', timestamp: NaN, date: 'unchanged' }]]) {
      const result = migrate({ username: 'empty', hits }, 123);
      expect(result.users.empty.registeredAt).toBe(123);
      expect(migrate(result, 999)).toBe(result);
    }
    for (const registeredAt of [0, -100, 456]) {
      const record = { username: 'existing', registeredAt, hits: [], profile: { email: 'keep' } };
      expect(migrate({ schemaVersion: 2, users: { existing: record } }, 999).users.existing).toBe(record);
    }
  });

  it('repairs the whole legacy map once, round-trips extras, and records stored byte evidence', () => {
    const original = {
      old: { username: 'old', hits: [{ id: 'a', timestamp: 42, date: 'frozen', extra: true }], profile: { email: 'keep', custom: [1] }, unknown: { keep: true } },
      empty: { username: 'empty', hits: [], settings: { theme: 'keep' } },
      existing: { username: 'existing', hits: [], profile: { registrationDate: 0, unknown: 2 } },
    };
    localStorage.setItem('runawaylog-data', JSON.stringify(original));
    const before = localStorage.getItem('runawaylog-data');
    const writes = vi.spyOn(Storage.prototype, 'setItem');
    const first = readStore(123);
    const firstBytes = localStorage.getItem('runawaylog-data');
    expect(first.users.old.registeredAt).toBe(42);
    expect(first.users.empty.registeredAt).toBe(123);
    expect(first.users.existing).toEqual({ username: 'existing', registeredAt: 0, hits: [], profile: { unknown: 2 } });
    expect(first.users.old).toEqual({ ...original.old, registeredAt: 42, hits: [{ id: 'a', at: 42, extra: true }] });
    expect(writes).toHaveBeenCalledTimes(2);
    expect(readStore(999)).toEqual(first);
    expect(readRecord('old', 999)).toEqual(first.users.old);
    expect(readRecord('missing', 999)).toBeNull();
    expect(writes).toHaveBeenCalledTimes(2);
    console.log(JSON.stringify({ before, firstBytes, secondBytes: localStorage.getItem('runawaylog-data'), writes: writes.mock.calls.length }));
    writeRecord({ username: 'new', registeredAt: 8, hits: [] });
    expect(readStore().users.old).toEqual(first.users.old);
    expect(readStore().unknown).toEqual(first.unknown);
  });
});
