import { useSyncExternalStore } from 'react';
import { getLanguagePreference, setLanguagePreference } from '../storage/preferences';
import { locales, languageCodes, resolveLanguage, getLocaleMetadata } from './registry';
import type { SupportedLanguage } from './registry';
export type { SupportedLanguage } from './registry';
export { getLocaleMetadata } from './registry';
type LanguageChangeCallback = () => void;
type Variables = Record<string, string | number>;

class I18n {
  private currentLanguage: SupportedLanguage = 'en_us';
  private listeners: Set<LanguageChangeCallback> = new Set();

  constructor() {
    this.currentLanguage = resolveLanguage(getLanguagePreference() || navigator.language);
  }

  public setLanguage(lang: string): void {
    const normalizedLang = resolveLanguage(lang);
    if (this.currentLanguage !== normalizedLang) {
      this.currentLanguage = normalizedLang;
      setLanguagePreference(normalizedLang);
      this.listeners.forEach(callback => {
        try {
          callback();
        } catch (error) {
          console.error('Error in language change callback:', error);
        }
      });
    }
  }

  public getLanguage(): SupportedLanguage {
    return this.currentLanguage;
  }

  public onLanguageChange(callback: LanguageChangeCallback): () => void {
    this.listeners.add(callback);
    return () => { this.listeners.delete(callback); };
  }

  // Missing keys/non-string branches return their path, as in the shipped API.
  public t(path: string, params: Variables = {}): string {
    let value: unknown = locales[this.currentLanguage].translations;
    for (const key of path.split('.')) {
      if (value && typeof value === 'object' && key in value) {
        value = (value as Record<string, unknown>)[key];
      } else {
        console.warn(`Translation key not found: ${path}`);
        return path;
      }
    }
    if (typeof value !== 'string') {
      console.warn(`Translation value is not a string: ${path}`);
      return path;
    }
    return value.replace(/\{([^}]+)\}/g, (_, key) => params[key] !== undefined ? String(params[key]) : `{${key}}`);
  }

  public getSupportedLanguages(): { code: SupportedLanguage; name: string }[] {
    return languageCodes.map(code => ({ code, name: locales[code].metadata.name }));
  }

  public getQuotes(): readonly string[] {
    return locales[this.currentLanguage].translations.quotes;
  }

  public getMetadata() {
    return getLocaleMetadata(this.currentLanguage);
  }
}

export const i18n = new I18n();
export const t = (key: string, vars?: Variables): string => i18n.t(key, vars);
const subscribe = (callback: LanguageChangeCallback) => i18n.onLanguageChange(callback);
const getSnapshot = () => i18n.getLanguage();

export function useT(): typeof t {
  useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  return t;
}
