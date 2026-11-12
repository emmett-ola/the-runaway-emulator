import { describe, it, expect, beforeEach, vi } from 'vitest';
import { loadUserData, saveUserData, addHit } from '../storage';
import type { UserData } from '../types';

describe('storage', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    // Set timezone to UTC for consistent test results
    localStorage.setItem('runawaylog-timezone', 'UTC');
  });

  describe('loadUserData', () => {
    it('returns null when no data exists', async () => {
      const result = await loadUserData('testuser');
      expect(result).toBeNull();
    });

    it('returns null when user does not exist', async () => {
      const data = {
        otheruser: { username: 'otheruser', hits: [] }
      };
      localStorage.setItem('runawaylog-data', JSON.stringify(data));
      
      const result = await loadUserData('testuser');
      expect(result).toBeNull();
    });

    it('loads existing user data', async () => {
      const userData: UserData = {
        username: 'testuser',
        hits: [
          { id: '1', timestamp: 1234567890000, date: '2009-02-13' }
        ]
      };
      const data = { testuser: userData };
      localStorage.setItem('runawaylog-data', JSON.stringify(data));
      
      const result = await loadUserData('testuser');
      const repairedData = {
        ...userData,
        profile: { registrationDate: 1234567890000 }
      };
      expect(result?.username).toBe(userData.username);
      expect(result?.hits).toEqual(userData.hits);
      expect(result).toEqual(repairedData);
      expect(JSON.parse(localStorage.getItem('runawaylog-data')!)).toEqual({ testuser: repairedData });
    });

    it('retains the repaired registration date on a second load after the clock changes', async () => {
      localStorage.setItem('runawaylog-data', JSON.stringify({
        testuser: { username: 'testuser', hits: [] }
      }));
      const clock = vi.spyOn(Date, 'now').mockReturnValue(1234567890000);
      try {
        const first = await loadUserData('testuser');
        expect(first?.profile?.registrationDate).toBe(1234567890000);
        clock.mockReturnValue(1234567900000);
        const second = await loadUserData('testuser');
        expect(second).toEqual(first);
        expect(second?.profile?.registrationDate).toBe(1234567890000);
        expect(JSON.parse(localStorage.getItem('runawaylog-data')!)).toEqual({ testuser: second });
      } finally {
        clock.mockRestore();
      }
    });

    it('handles corrupted data gracefully', async () => {
      localStorage.setItem('runawaylog-data', 'invalid json');
      
      const result = await loadUserData('testuser');
      expect(result).toBeNull();
    });
  });

  describe('saveUserData', () => {
    it('saves new user data', async () => {
      const userData: UserData = {
        username: 'testuser',
        hits: []
      };
      
      await saveUserData(userData);
      
      const stored = localStorage.getItem('runawaylog-data');
      expect(stored).toBeTruthy();
      const parsed = JSON.parse(stored!);
      expect(parsed.testuser).toEqual(userData);
    });

    it('updates existing user data', async () => {
      const initialData: UserData = {
        username: 'testuser',
        hits: [{ id: '1', timestamp: 1234567890000, date: '2009-02-13' }]
      };
      await saveUserData(initialData);
      
      const updatedData: UserData = {
        username: 'testuser',
        hits: [
          { id: '1', timestamp: 1234567890000, date: '2009-02-13' },
          { id: '2', timestamp: 1234567900000, date: '2009-02-13' }
        ]
      };
      await saveUserData(updatedData);
      
      const stored = localStorage.getItem('runawaylog-data');
      const parsed = JSON.parse(stored!);
      expect(parsed.testuser.hits).toHaveLength(2);
    });

    it('preserves other users data', async () => {
      const user1: UserData = { username: 'user1', hits: [] };
      const user2: UserData = { username: 'user2', hits: [] };
      
      await saveUserData(user1);
      await saveUserData(user2);
      
      const stored = localStorage.getItem('runawaylog-data');
      const parsed = JSON.parse(stored!);
      expect(parsed.user1).toEqual(user1);
      expect(parsed.user2).toEqual(user2);
    });
  });

  describe('addHit', () => {
    it('creates new user and adds hit', async () => {
      const hit = await addHit('testuser');
      
      expect(hit).toBeTruthy();
      expect(hit?.id).toBeTruthy();
      expect(hit?.timestamp).toBeGreaterThan(0);
      expect(hit?.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    it('adds hit to existing user', async () => {
      const userData: UserData = {
        username: 'testuser',
        hits: [{ id: '1', timestamp: 1234567890000, date: '2009-02-13' }]
      };
      await saveUserData(userData);
      
      const hit = await addHit('testuser');
      
      expect(hit).toBeTruthy();
      
      const loaded = await loadUserData('testuser');
      expect(loaded?.hits).toHaveLength(2);
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
      
      expect(hit?.timestamp).toBeGreaterThanOrEqual(before);
      expect(hit?.timestamp).toBeLessThanOrEqual(after);
    });
  });
});
