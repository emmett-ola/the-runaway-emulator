import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createStorageAdapter, getStorageMode, setStorageMode, LocalStorageAdapter } from '../../storage';
import { getTheme, setTheme } from '../../darkMode';
import { getSavedTimezone, saveTimezone } from '../../timezone';
import { getCalendarTheme, setCalendarTheme, readIdentityCache, writeIdentityCache, removeIdentityCache, getLanguagePreference, setLanguagePreference } from './preferences';

beforeEach(() => {
  localStorage.clear();
  document.documentElement.removeAttribute('data-theme');
});

describe('device preference persistence', () => {
  it('keeps calendar and locale preference bytes on their shipped device keys', () => {
    expect(getCalendarTheme()).toBe('github-green');
    setCalendarTheme('ocean-blue');
    setLanguagePreference('zh_tw');
    expect(localStorage.getItem('calendar-theme')).toBe('ocean-blue');
    expect(getCalendarTheme()).toBe('ocean-blue');
    expect(localStorage.getItem('app-language')).toBe('zh_tw');
    expect(getLanguagePreference()).toBe('zh_tw');
  });

  it('preserves opaque demo-identity cache bytes without changing keys or semantics', () => {
    const bytes = '{"token":"demo","expiresAt":42}';
    writeIdentityCache('token', bytes);
    writeIdentityCache('currentUser', '{"username":"demo"}');
    writeIdentityCache('credentials', '{"demo":"hash"}');
    expect(localStorage.getItem('runawaylog-token')).toBe(bytes);
    expect(readIdentityCache('token')).toBe(bytes);
    expect(localStorage.getItem('runawaylog-current-user')).toBe('{"username":"demo"}');
    expect(localStorage.getItem('runawaylog-credentials')).toBe('{"demo":"hash"}');
    removeIdentityCache('token');
    expect(readIdentityCache('token')).toBeNull();
    expect(readIdentityCache('credentials')).toBe('{"demo":"hash"}');
  });
  it('reads and writes the shipped dark-mode and timezone keys', () => {
    setTheme('dark');
    saveTimezone('Asia/Tokyo');
    expect(localStorage.getItem('app-theme')).toBe('dark');
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    expect(getTheme()).toBe('dark');
    expect(localStorage.getItem('runawaylog-timezone')).toBe('Asia/Tokyo');
    expect(getSavedTimezone()).toBe('Asia/Tokyo');
  });

  it.each(['cloud', 'unknown'])('repairs unavailable stored mode %s to local without touching records', (mode) => {
    localStorage.setItem('runawaylog-storage-mode', mode);
    localStorage.setItem('runawaylog-data', '{"kept":true}');
    expect(getStorageMode()).toBe('local');
    expect(localStorage.getItem('runawaylog-storage-mode')).toBe('local');
    expect(localStorage.getItem('runawaylog-data')).toBe('{"kept":true}');
  });

  it('cannot select or instantiate cloud storage and attempts no network request', () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    setStorageMode('cloud');
    expect(localStorage.getItem('runawaylog-storage-mode')).toBe('local');
    expect(createStorageAdapter('cloud')).toBeInstanceOf(LocalStorageAdapter);
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });
});
