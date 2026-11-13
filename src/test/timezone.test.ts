import { describe, it, expect, beforeEach } from 'vitest';
import {
  getTimezones,
  getBrowserTimezone,
  getSavedTimezone,
  saveTimezone,
  timestampToDateString,
  getCurrentTimestamp,
  formatDateInTimezone,
  getTimezoneDisplayName,
} from '../lib/time';

describe('timezone', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  describe('getTimezones', () => {
    it('returns an array of timezones', () => {
      const timezones = getTimezones();
      expect(Array.isArray(timezones)).toBe(true);
      expect(timezones.length).toBeGreaterThan(0);
    });

    it('includes UTC', () => {
      const timezones = getTimezones();
      expect(timezones).toContain('UTC');
    });

    it('includes major cities', () => {
      const timezones = getTimezones();
      expect(timezones).toContain('America/New_York');
      expect(timezones).toContain('Europe/London');
      expect(timezones).toContain('Asia/Tokyo');
    });
  });

  describe('getBrowserTimezone', () => {
    it('returns a string', () => {
      const timezone = getBrowserTimezone();
      expect(typeof timezone).toBe('string');
      expect(timezone.length).toBeGreaterThan(0);
    });

    it('returns a valid timezone format', () => {
      const timezone = getBrowserTimezone();
      // Should be either UTC or Region/City format
      expect(timezone === 'UTC' || timezone.includes('/')).toBe(true);
    });
  });

  describe('getSavedTimezone and saveTimezone', () => {
    it('returns browser timezone when nothing is saved', () => {
      const timezone = getSavedTimezone();
      expect(typeof timezone).toBe('string');
      expect(timezone.length).toBeGreaterThan(0);
    });

    it('saves and retrieves timezone', () => {
      saveTimezone('America/New_York');
      const retrieved = getSavedTimezone();
      expect(retrieved).toBe('America/New_York');
    });

    it('overwrites previous timezone', () => {
      saveTimezone('America/New_York');
      saveTimezone('Europe/London');
      const retrieved = getSavedTimezone();
      expect(retrieved).toBe('Europe/London');
    });
  });

  describe('timestampToDateString', () => {
    it('converts timestamp to YYYY-MM-DD format', () => {
      const timestamp = 1234567890000; // 2009-02-13 23:31:30 UTC
      const dateStr = timestampToDateString(timestamp, 'UTC');
      expect(dateStr).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    it('handles UTC timezone', () => {
      const timestamp = 1234567890000; // 2009-02-13 23:31:30 UTC
      const dateStr = timestampToDateString(timestamp, 'UTC');
      expect(dateStr).toBe('2009-02-13');
    });

    it('handles different timezones', () => {
      const timestamp = 1234567890000; // 2009-02-13 23:31:30 UTC
      const utcDate = timestampToDateString(timestamp, 'UTC');
      const nyDate = timestampToDateString(timestamp, 'America/New_York');
      
      // Both should be valid date strings
      expect(utcDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(nyDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    it('handles midnight edge case', () => {
      const timestamp = new Date('2024-01-01T00:00:00Z').getTime();
      const dateStr = timestampToDateString(timestamp, 'UTC');
      expect(dateStr).toBe('2024-01-01');
    });
  });

  describe('getCurrentTimestamp', () => {
    it('returns a number', () => {
      const timestamp = getCurrentTimestamp();
      expect(typeof timestamp).toBe('number');
    });

    it('returns a positive number', () => {
      const timestamp = getCurrentTimestamp();
      expect(timestamp).toBeGreaterThan(0);
    });

    it('returns current time', () => {
      const before = Date.now();
      const timestamp = getCurrentTimestamp();
      const after = Date.now();
      
      expect(timestamp).toBeGreaterThanOrEqual(before);
      expect(timestamp).toBeLessThanOrEqual(after);
    });
  });

  describe('formatDateInTimezone', () => {
    it('formats date with time', () => {
      const timestamp = 1234567890000;
      const formatted = formatDateInTimezone(timestamp, 'UTC');
      
      expect(typeof formatted).toBe('string');
      expect(formatted.length).toBeGreaterThan(0);
    });

    it('includes month, day, year, and time', () => {
      const timestamp = 1234567890000;
      const formatted = formatDateInTimezone(timestamp, 'UTC');
      
      // Should contain numbers and time separators
      expect(formatted).toMatch(/\d/);
      expect(formatted).toMatch(/:/);
    });
  });

  describe('getTimezoneDisplayName', () => {
    it('returns a string', () => {
      const displayName = getTimezoneDisplayName('UTC');
      expect(typeof displayName).toBe('string');
    });

    it('includes timezone name', () => {
      const displayName = getTimezoneDisplayName('America/New_York');
      expect(displayName).toContain('America');
      expect(displayName).toContain('New York');
    });

    it('includes UTC offset', () => {
      const displayName = getTimezoneDisplayName('UTC');
      expect(displayName).toContain('UTC');
    });

    it('handles invalid timezone gracefully', () => {
      const displayName = getTimezoneDisplayName('Invalid/Timezone');
      expect(typeof displayName).toBe('string');
      expect(displayName.length).toBeGreaterThan(0);
    });
  });
});
