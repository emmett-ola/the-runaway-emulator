import { describe, it, expect, beforeEach, vi } from 'vitest';
import { loadUserData, saveUserData, addHit } from '../storage';
import type { UserData } from '../types';
import { timestampToDateString } from '../lib/time';

describe('storage', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    localStorage.setItem('runawaylog-timezone', 'UTC');
  });

  describe('loadUserData', () => {
    it('returns null when no data exists', async () => {
      expect(await loadUserData('testuser')).toBeNull();
    });
    it('returns null when user does not exist', async () => {
      localStorage.setItem('runawaylog-data', JSON.stringify({ otheruser: { username: 'otheruser', hits: [] } }));
      expect(await loadUserData('testuser')).toBeNull();
    });
    it('loads existing user data', async () => {
      const userData: UserData = { username: 'testuser', registeredAt: 1234567890000, hits: [{ id: '1', at: 1234567890000 }] };
      const store = { schemaVersion: 2, users: { testuser: userData } };
      localStorage.setItem('runawaylog-data', JSON.stringify(store));
      const result = await loadUserData('testuser');
      expect(result?.username).toBe(userData.username);
      expect(result?.hits).toEqual(userData.hits);
      expect(result).toEqual(userData);
      expect(JSON.parse(localStorage.getItem('runawaylog-data')!)).toEqual(store);
    });
    it('retains the repaired registration date on a second load after the clock changes', async () => {
      localStorage.setItem('runawaylog-data', JSON.stringify({ testuser: { username: 'testuser', hits: [] } }));
      const clock = vi.spyOn(Date, 'now').mockReturnValue(1234567890000);
      try {
        const first = await loadUserData('testuser');
        expect(first?.registeredAt).toBe(1234567890000);
        clock.mockReturnValue(1234567900000);
        const second = await loadUserData('testuser');
        expect(second).toEqual(first);
        expect(second?.registeredAt).toBe(1234567890000);
        expect(JSON.parse(localStorage.getItem('runawaylog-data')!).users).toEqual({ testuser: second });
      } finally {
        clock.mockRestore();
      }
    });
    it('handles corrupted data gracefully', async () => {
      localStorage.setItem('runawaylog-data', 'invalid json');
      expect(await loadUserData('testuser')).toBeNull();
      expect(localStorage.getItem('runawaylog-data')).toBe('invalid json');
    });
  });

  describe('saveUserData', () => {
    it('saves new user data', async () => {
      const userData: UserData = { username: 'testuser', registeredAt: 1, hits: [] };
      await saveUserData(userData);
      const stored = localStorage.getItem('runawaylog-data');
      expect(stored).toBeTruthy();
      expect(JSON.parse(stored!).users.testuser).toEqual(userData);
    });
    it('updates existing user data', async () => {
      const initialData: UserData = { username: 'testuser', registeredAt: 1, hits: [{ id: '1', at: 1234567890000 }] };
      await saveUserData(initialData);
      const updatedData: UserData = { ...initialData, hits: [...initialData.hits, { id: '2', at: 1234567900000 }] };
      await saveUserData(updatedData);
      expect(JSON.parse(localStorage.getItem('runawaylog-data')!).users.testuser.hits).toHaveLength(2);
    });
    it('preserves other users data', async () => {
      const user1: UserData = { username: 'user1', registeredAt: 1, hits: [] };
      const user2: UserData = { username: 'user2', registeredAt: 2, hits: [] };
      await saveUserData(user1);
      await saveUserData(user2);
      const parsed = JSON.parse(localStorage.getItem('runawaylog-data')!);
      expect(parsed.users.user1).toEqual(user1);
      expect(parsed.users.user2).toEqual(user2);
    });
  });

  describe('addHit', () => {
    it('creates new user and adds hit', async () => {
      const hit = await addHit('testuser');
      expect(hit).toBeTruthy();
      expect(hit?.id).toBeTruthy();
      expect(hit?.at).toBeGreaterThan(0);
      expect(timestampToDateString(hit!.at, 'UTC')).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(hit).not.toHaveProperty('date');
      expect(hit).not.toHaveProperty('timestamp');
    });
    it('adds hit to existing user', async () => {
      const userData: UserData = { username: 'testuser', registeredAt: 1, hits: [{ id: '1', at: 1234567890000 }] };
      await saveUserData(userData);
      expect(await addHit('testuser')).toBeTruthy();
      expect((await loadUserData('testuser'))?.hits).toHaveLength(2);
    });
    it('generates unique IDs', async () => {
      const hit1 = await addHit('testuser');
      const hit2 = await addHit('testuser');
      expect(hit1?.id).not.toEqual(hit2?.id);
    });
    it('stores current timestamp', async () => {
      const before = Date.now();
      const hit = await addHit('testuser');
      const after = Date.now();
      expect(hit?.at).toBeGreaterThanOrEqual(before);
      expect(hit?.at).toBeLessThanOrEqual(after);
    });
    it('timezone changes never rewrite stored hits or registration', async () => {
      await addHit('testuser');
      const bytes = localStorage.getItem('runawaylog-data');
      localStorage.setItem('runawaylog-timezone', 'America/Los_Angeles');
      await loadUserData('testuser');
      expect(localStorage.getItem('runawaylog-data')).toBe(bytes);
      const user = JSON.parse(bytes!).users.testuser;
      expect(Object.keys(user.hits[0]).sort()).toEqual(['at', 'id']);
      expect(user.registeredAt).toBeGreaterThan(0);
    });
  });
});
