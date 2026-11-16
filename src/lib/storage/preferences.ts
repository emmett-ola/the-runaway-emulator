import type { DevicePreferences, CommitReceipt } from './state-model';
export type AppearancePreference = 'light' | 'dark';
export type StorageMode = 'local' | 'cloud';

export const defaultPreferences = (): DevicePreferences => ({
  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
  appearance: typeof matchMedia !== 'undefined' && matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light',
  language: typeof navigator === 'undefined' ? 'en-US' : navigator.language,
  calendarTheme: 'github-green', mode: 'local',
});
let preferences: Readonly<DevicePreferences> = Object.freeze(defaultPreferences());
const listeners = new Set<() => void>();
let persist: ((patch: Partial<DevicePreferences>) => Promise<CommitReceipt>) | undefined;
export const subscribePreferences = (listener: () => void): (() => void) => { listeners.add(listener); return () => listeners.delete(listener); };
export const getPreferencesSnapshot = (): Readonly<DevicePreferences> => preferences;
export const publishPreferences = (value: DevicePreferences): void => {
  if (JSON.stringify(value) === JSON.stringify(preferences)) return;
  preferences = Object.freeze({ ...value });
  listeners.forEach(listener => listener());
};
export const configurePreferences = (writer: (patch: Partial<DevicePreferences>) => Promise<CommitReceipt>): void => { persist = writer; };
export const validatePreferences = (value: DevicePreferences): void => {
  if (!value || !['light', 'dark'].includes(value.appearance) || value.mode !== 'local' || typeof value.calendarTheme !== 'string' || typeof value.language !== 'string' || typeof value.timezone !== 'string') throw new Error('Invalid device preferences.');
  new Intl.DateTimeFormat('en', { timeZone: value.timezone });
};
export const changePreferences = async (patch: Partial<DevicePreferences>): Promise<void> => {
  const next = { ...preferences, ...patch, mode: 'local' as const };
  validatePreferences(next);
  if (persist) await persist(patch);
  else publishPreferences(next); // Volatile until first login; never reported as durable.
};
export const getAppearance = (): AppearancePreference => preferences.appearance;
export const setAppearance = (appearance: AppearancePreference): Promise<void> => changePreferences({ appearance });
export const getCalendarTheme = (): string => preferences.calendarTheme;
export const setCalendarTheme = (calendarTheme: string): Promise<void> => changePreferences({ calendarTheme });
export const getLanguagePreference = (): string => preferences.language;
export const setLanguagePreference = (language: string): Promise<void> => changePreferences({ language });
export const getTimezonePreference = (): string => preferences.timezone;
export const setTimezonePreference = (timezone: string): Promise<void> => changePreferences({ timezone });
export const getStorageMode = (): StorageMode => 'local';
export const setStorageMode = async (mode: StorageMode): Promise<void> => {
  void mode;
  await changePreferences({ mode: 'local' });
};

// Only identity is tab-scoped. Password-derived material never enters this cache.
type IdentityCache = 'currentUser' | 'username';
const key = (cache: IdentityCache): string => `runawaylog-v2-session-${cache}`;
export const readIdentityCache = (cache: IdentityCache): string | null => sessionStorage.getItem(key(cache));
export const writeIdentityCache = (cache: IdentityCache, value: string): void => sessionStorage.setItem(key(cache), value);
export const removeIdentityCache = (cache: IdentityCache): void => sessionStorage.removeItem(key(cache));
export const clearObsoleteAuthCache = (): void => {
  sessionStorage.removeItem('runawaylog-v2-session-credentials');
  sessionStorage.removeItem('runawaylog-v2-session-token');
};
export const resetPreferences = (): void => { persist = undefined; preferences = Object.freeze(defaultPreferences()); };
