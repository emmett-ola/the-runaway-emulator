import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { UserData } from '../../types';
import { ensureRegistrationDate, readWholeMap, readRecord, writeRecord, writeWholeMap } from './index';

describe('legacy registration repair', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => vi.restoreAllMocks());

  it('uses the earliest finite timestamp and preserves all legacy fields', () => {
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
    const result = ensureRegistrationDate(record as unknown as UserData, 900);
    expect(result).toEqual({ ...record, profile: { ...record.profile, registrationDate: 0 } });
    expect(result.hits).toBe(record.hits);
    expect(record.profile).not.toHaveProperty('registrationDate');
  });

  it('uses now for empty or non-finite history and preserves existing dates idempotently', () => {
    for (const hits of [[], [{ id: 'bad', timestamp: NaN, date: 'unchanged' }]]) {
      const result = ensureRegistrationDate({ username: 'empty', hits }, 123);
      expect(result.profile?.registrationDate).toBe(123);
      expect(ensureRegistrationDate(result, 999)).toBe(result);
    }
    for (const registrationDate of [0, -100, 456]) {
      const record = { username: 'existing', hits: [], profile: { registrationDate, email: 'keep' } };
      expect(ensureRegistrationDate(record, 999)).toBe(record);
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
    const first = readWholeMap(123);
    const firstBytes = localStorage.getItem('runawaylog-data');
    expect(first.old.profile?.registrationDate).toBe(42);
    expect(first.empty.profile?.registrationDate).toBe(123);
    expect(first.existing).toEqual(original.existing);
    expect(first.old).toEqual({ ...original.old, profile: { ...original.old.profile, registrationDate: 42 } });
    expect(writes).toHaveBeenCalledTimes(1);
    expect(readWholeMap(999)).toEqual(first);
    expect(readRecord('old', 999)).toEqual(first.old);
    expect(readRecord('missing', 999)).toBeNull();
    expect(writes).toHaveBeenCalledTimes(1);
    console.log(JSON.stringify({ before, firstBytes, secondBytes: localStorage.getItem('runawaylog-data'), writes: writes.mock.calls.length }));
    writeRecord({ username: 'new', hits: [], profile: { registrationDate: 8 } });
    expect(readWholeMap().old).toEqual(first.old);
    writeWholeMap(first);
    expect(localStorage.getItem('runawaylog-data')).toBe(firstBytes);
  });
});
