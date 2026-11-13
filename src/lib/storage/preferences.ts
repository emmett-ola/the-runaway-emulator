// Device-level preferences keep their shipped keys and remain outside user records.
export type AppearancePreference = 'light' | 'dark';
export type StorageMode = 'local' | 'cloud';

export const getAppearance = (): string | null => localStorage.getItem('app-theme');
export const setAppearance = (theme: AppearancePreference): void => localStorage.setItem('app-theme', theme);
export const getCalendarTheme = (): string => localStorage.getItem('calendar-theme') || 'github-green';
export const setCalendarTheme = (theme: string): void => localStorage.setItem('calendar-theme', theme);
export const getLanguagePreference = (): string | null => localStorage.getItem('app-language');
export const setLanguagePreference = (language: string): void => localStorage.setItem('app-language', language);
export const getTimezonePreference = (): string | null => localStorage.getItem('runawaylog-timezone');
export const setTimezonePreference = (timezone: string): void => localStorage.setItem('runawaylog-timezone', timezone);

export const getStorageMode = (): StorageMode => {
  try {
    if (localStorage.getItem('runawaylog-storage-mode') !== 'local') {
      localStorage.setItem('runawaylog-storage-mode', 'local');
    }
  } catch (error) {
    console.error('Error getting storage mode:', error);
  }
  return 'local';
};

// Cloud is an unavailable placeholder, including for legacy callers.
export const setStorageMode = (mode: StorageMode): void => {
  if (mode === 'local' || mode === 'cloud') {
    try {
      localStorage.setItem('runawaylog-storage-mode', 'local');
    } catch (error) {
      console.error('Error setting storage mode:', error);
    }
  }
};

// Opaque legacy demo-identity bytes: storage owns keys, auth owns semantics.
const identityKeys = {
  token: 'runawaylog-token',
  currentUser: 'runawaylog-current-user',
  credentials: 'runawaylog-credentials',
} as const;
type IdentityCache = keyof typeof identityKeys;
export const readIdentityCache = (cache: IdentityCache): string | null => localStorage.getItem(identityKeys[cache]);
const preserveIdentityMirror = (): void => {
  const raw = localStorage.getItem(identityKeys.currentUser);
  if (raw === null) return;
  try {
    const identity: unknown = JSON.parse(raw);
    if (identity && typeof identity === 'object' && Object.keys(identity).length === 1 && 'username' in identity && typeof identity.username === 'string') return;
  } catch { /* Unreadable mirror bytes also belong in the recovery archive. */ }
  const existing = localStorage.getItem('runawaylog-current-user-backups');
  const backups: unknown = existing === null ? [] : JSON.parse(existing);
  if (!Array.isArray(backups) || backups.some(value => typeof value !== 'string')) throw new Error('Invalid identity recovery archive');
  if (!backups.includes(raw)) localStorage.setItem('runawaylog-current-user-backups', JSON.stringify([...backups, raw]));
};
export const writeIdentityCache = (cache: IdentityCache, value: string): void => {
  if (cache === 'currentUser') preserveIdentityMirror();
  localStorage.setItem(identityKeys[cache], value);
};
export const removeIdentityCache = (cache: IdentityCache): void => {
  if (cache === 'currentUser') preserveIdentityMirror();
  localStorage.removeItem(identityKeys[cache]);
};
