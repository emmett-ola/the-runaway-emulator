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
export const writeIdentityCache = (cache: IdentityCache, value: string): void => localStorage.setItem(identityKeys[cache], value);
export const removeIdentityCache = (cache: IdentityCache): void => localStorage.removeItem(identityKeys[cache]);
