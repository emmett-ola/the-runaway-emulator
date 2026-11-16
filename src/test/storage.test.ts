import { describe, it, expect, beforeEach, vi } from 'vitest';
import { loadUserData, addHit } from '../storage';
import type { UserData } from '../types';
import { timestampToDateString, saveTimezone } from '../lib/time';
import { appendHit, createAccount, initializeStorage, readFullRecord, readRecord, readStore, resetStorage, updateProfile } from '../lib/storage';
import { seedRecord } from './storage-fixtures';

describe('storage', () => {
  beforeEach(async () => {
    localStorage.clear();
    vi.clearAllMocks();
    await saveTimezone('UTC');
  });

  describe('loadUserData', () => {
    it('returns null when no data exists', async () => {
      expect(await loadUserData('testuser')).toBeNull();
    });
    it('returns null when user does not exist', async () => {
      await seedRecord({ username: 'otheruser', registeredAt: 1, hits: [] });
      expect(await loadUserData('testuser')).toBeNull();
    });
    it('loads existing user data', async () => {
      const userData: UserData = { username: 'testuser', registeredAt: 1234567890000, hits: [{ id: '1', at: 1234567890000 }] };
      await seedRecord(userData);
      const result = await loadUserData('testuser');
      expect(result?.username).toBe(userData.username);
      expect(result?.total).toBe(userData.hits.length);
      expect(result).not.toHaveProperty('hits');
      expect((await readFullRecord('testuser')).hits).toEqual(userData.hits);
      expect(result).toEqual(await readRecord('testuser'));
      expect(localStorage.getItem('runawaylog-data')).toBeNull();
    });
    it('retains the repaired registration date on a second load after the clock changes', async () => {
      localStorage.setItem('runawaylog-data', JSON.stringify({ testuser: { username: 'testuser', hits: [] } }));
      const legacyBytes = localStorage.getItem('runawaylog-data');
      const clock = vi.spyOn(Date, 'now').mockReturnValue(1234567890000);
      try {
        expect(await loadUserData('testuser')).toBeNull();
        await createAccount('testuser');
        const first = await loadUserData('testuser');
        expect(first?.registeredAt).toBe(1234567890000);
        clock.mockReturnValue(1234567900000);
        await resetStorage();
        await initializeStorage();
        const second = await loadUserData('testuser');
        expect(second).toEqual(first);
        expect(second?.registeredAt).toBe(1234567890000);
        expect((await readStore()).users).toEqual({ testuser: second });
        expect(localStorage.getItem('runawaylog-data')).toBe(legacyBytes);
      } finally {
        clock.mockRestore();
      }
    });
    it('handles corrupted data gracefully', async () => {
      localStorage.setItem('runawaylog-data', 'invalid json');
      await resetStorage();
      await initializeStorage();
      expect(await loadUserData('testuser')).toBeNull();
      expect(localStorage.getItem('runawaylog-data')).toBe('invalid json');
    });
  });

  describe('saveUserData', () => {
    it('saves new user data', async () => {
      const userData: UserData = { username: 'testuser', registeredAt: 1, hits: [] };
      await seedRecord(userData);
      await resetStorage();
      await initializeStorage();
      expect(await readFullRecord('testuser')).toMatchObject(userData);
      expect(localStorage.getItem('runawaylog-data')).toBeNull();
    });
    it('updates existing user data', async () => {
      const initialData: UserData = { username: 'testuser', registeredAt: 1, hits: [{ id: '1', at: 1234567890000 }] };
      await seedRecord(initialData);
      const account = (await readRecord('testuser'))!;
      const next = { id: '2', at: 1234567900000 };
      await appendHit(account.accountId, next);
      await updateProfile(account.accountId, { email: 'updated@example.test' });
      const record = await readFullRecord('testuser');
      expect(record.hits).toEqual([...initialData.hits, next]);
      expect(record.registeredAt).toBe(initialData.registeredAt);
      expect(record.profile?.email).toBe('updated@example.test');
    });
    it('preserves other users data', async () => {
      const user1: UserData = { username: 'user1', registeredAt: 1, hits: [] };
      const user2: UserData = { username: 'user2', registeredAt: 2, hits: [] };
      await seedRecord(user1);
      const before = await readFullRecord('user1');
      await seedRecord(user2);
      expect(await readFullRecord('user1')).toEqual(before);
      expect(await readFullRecord('user1')).toMatchObject(user1);
      expect(await readFullRecord('user2')).toMatchObject(user2);
    });
  });

  describe('addHit', () => {
    it('creates new user and adds hit', async () => {
      await createAccount('testuser');
      const hit = await addHit('testuser');
      expect(hit).toBeTruthy();
      expect(hit?.id).toBeTruthy();
      expect(hit?.at).toBeGreaterThan(0);
      expect(timestampToDateString(hit!.at, 'UTC')).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(hit).not.toHaveProperty('date');
      expect(hit).not.toHaveProperty('timestamp');
      expect((await readFullRecord('testuser')).hits).toEqual([hit]);
    });
    it('adds hit to existing user', async () => {
      const userData: UserData = { username: 'testuser', registeredAt: 1, hits: [{ id: '1', at: 1234567890000 }] };
      await seedRecord(userData);
      expect(await addHit('testuser')).toBeTruthy();
      expect((await loadUserData('testuser'))?.total).toBe(2);
      expect((await readFullRecord('testuser')).hits).toHaveLength(2);
    });
    it('generates unique IDs', async () => {
      await createAccount('testuser');
      const hit1 = await addHit('testuser');
      const hit2 = await addHit('testuser');
      expect(hit1?.id).not.toEqual(hit2?.id);
    });
    it('stores current timestamp', async () => {
      const before = Date.now();
      await createAccount('testuser');
      const hit = await addHit('testuser');
      const after = Date.now();
      expect(hit?.at).toBeGreaterThanOrEqual(before);
      expect(hit?.at).toBeLessThanOrEqual(after);
    });
    it('timezone changes never rewrite stored hits or registration', async () => {
      await createAccount('testuser');
      await addHit('testuser');
      const before = await readFullRecord('testuser');
      const descriptors = (await readRecord('testuser'))!.index.chunks;
      await saveTimezone('America/Los_Angeles');
      await loadUserData('testuser');
      const user = await readFullRecord('testuser');
      expect(user).toEqual(before);
      expect((await readRecord('testuser'))!.index.chunks).toEqual(descriptors);
      expect(Object.keys(user.hits[0]).sort()).toEqual(['at', 'id', 'recordVersion', 'schemaVersion']);
      expect(user.registeredAt).toBeGreaterThan(0);
    });
  });
});
