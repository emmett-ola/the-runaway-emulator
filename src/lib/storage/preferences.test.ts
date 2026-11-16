import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createStorageAdapter, getStorageMode, setStorageMode, LocalStorageAdapter } from '../../storage';
import { getTheme, setTheme } from '../../darkMode';
import { getSavedTimezone, saveTimezone } from '../time';
import { createAccount, initializeStorage, readPreferences, resetStorage } from './index';
import { getCalendarTheme, setCalendarTheme, readIdentityCache, writeIdentityCache, removeIdentityCache, clearObsoleteAuthCache, getLanguagePreference, setLanguagePreference } from './preferences';

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  document.documentElement.removeAttribute('data-theme');
});

describe('device preference persistence', () => {
  it('keeps calendar and locale preference bytes on their shipped device keys', async () => {
    localStorage.setItem('calendar-theme', 'obsolete');
    localStorage.setItem('app-language', 'obsolete');
    expect(getCalendarTheme()).toBe('github-green');
    await setCalendarTheme('ocean-blue');
    await setLanguagePreference('zh_tw');
    await createAccount('preferences');
    await resetStorage();
    await initializeStorage();
    expect(getCalendarTheme()).toBe('ocean-blue');
    expect(getLanguagePreference()).toBe('zh_tw');
    expect((await readPreferences()).calendarTheme).toBe('ocean-blue');
    expect(localStorage.getItem('calendar-theme')).toBe('obsolete');
    expect(localStorage.getItem('app-language')).toBe('obsolete');
  });

  it('retains only tab identity and removes historical credential/token caches without reading obsolete local keys', () => {
    localStorage.setItem('runawaylog-token', 'obsolete token');
    localStorage.setItem('runawaylog-current-user', 'obsolete identity');
    localStorage.setItem('runawaylog-credentials', 'obsolete credentials');
    sessionStorage.setItem('runawaylog-v2-session-credentials', 'SYNTHETIC-OBSOLETE');
    sessionStorage.setItem('runawaylog-v2-session-token', 'SYNTHETIC-OBSOLETE');
    writeIdentityCache('currentUser', '{"username":"demo"}');
    writeIdentityCache('username', 'demo');
    clearObsoleteAuthCache();
    expect(readIdentityCache('currentUser')).toBe('{"username":"demo"}');
    expect(readIdentityCache('username')).toBe('demo');
    expect(sessionStorage.getItem('runawaylog-v2-session-credentials')).toBeNull();
    expect(sessionStorage.getItem('runawaylog-v2-session-token')).toBeNull();
    expect(localStorage.getItem('runawaylog-token')).toBe('obsolete token');
    expect(localStorage.getItem('runawaylog-current-user')).toBe('obsolete identity');
    expect(localStorage.getItem('runawaylog-credentials')).toBe('obsolete credentials');
    removeIdentityCache('currentUser');
    expect(readIdentityCache('currentUser')).toBeNull();
    expect(readIdentityCache('username')).toBe('demo');
    sessionStorage.clear();
    expect(readIdentityCache('username')).toBeNull();
  });
  it('reads and writes the shipped dark-mode and timezone keys', async () => {
    localStorage.setItem('app-theme', 'obsolete');
    localStorage.setItem('runawaylog-timezone', 'obsolete');
    await setTheme('dark');
    await saveTimezone('Asia/Tokyo');
    await createAccount('appearance');
    await resetStorage();
    await initializeStorage();
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    expect(getTheme()).toBe('dark');
    expect(getSavedTimezone()).toBe('Asia/Tokyo');
    expect(localStorage.getItem('app-theme')).toBe('obsolete');
    expect(localStorage.getItem('runawaylog-timezone')).toBe('obsolete');
  });

  it.each(['cloud', 'unknown'])('repairs unavailable stored mode %s to local without touching records', async mode => {
    localStorage.setItem('runawaylog-storage-mode', mode);
    localStorage.setItem('runawaylog-data', '{"kept":true}');
    await resetStorage();
    await initializeStorage();
    expect(getStorageMode()).toBe('local');
    expect(localStorage.getItem('runawaylog-storage-mode')).toBe(mode);
    expect(localStorage.getItem('runawaylog-data')).toBe('{"kept":true}');
  });

  it('cannot select or instantiate cloud storage and attempts no network request', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    await setStorageMode('cloud');
    expect(getStorageMode()).toBe('local');
    expect((await readPreferences()).mode).toBe('local');
    expect(localStorage.getItem('runawaylog-storage-mode')).toBeNull();
    expect(createStorageAdapter('cloud')).toBeInstanceOf(LocalStorageAdapter);
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });
});
