import { useSyncExternalStore } from 'react';
import { getLanguagePreference, setLanguagePreference } from '../storage/preferences';
import { en_us } from './locales/en_us';
import { zh_cn } from './locales/zh_cn';
import { zh_tw } from './locales/zh_tw';
import type { Translations } from './locales/en_us';

export type SupportedLanguage = 'en_us' | 'zh_cn' | 'zh_tw';
type LanguageChangeCallback = () => void;
type Variables = Record<string, string | number>;

class I18n {
  private currentLanguage: SupportedLanguage = 'en_us';
  private translations: Record<SupportedLanguage, Translations> = { en_us, zh_cn, zh_tw };
  private listeners: Set<LanguageChangeCallback> = new Set();

  constructor() {
    const savedLang = getLanguagePreference();
    if (savedLang && this.isSupportedLanguage(savedLang)) {
      this.currentLanguage = savedLang;
      return;
    }
    const browserLang = navigator.language.toLowerCase();
    if (browserLang.includes('zh-cn') || browserLang.includes('zh-sg')) {
      this.currentLanguage = 'zh_cn';
    } else if (browserLang.includes('zh-tw') || browserLang.includes('zh-hk')) {
      this.currentLanguage = 'zh_tw';
    }
  }

  private isSupportedLanguage(lang: string): lang is SupportedLanguage {
    return Object.keys(this.translations).includes(lang);
  }

  public setLanguage(lang: string): void {
    let normalizedLang: SupportedLanguage;
    switch (lang) {
      case 'en':
      case 'en_us':
        normalizedLang = 'en_us';
        break;
      case 'zh':
      case 'zh_cn':
        normalizedLang = 'zh_cn';
        break;
      case 'zh_tw':
      case 'zh_hk':
        normalizedLang = 'zh_tw';
        break;
      default:
        normalizedLang = 'en_us';
    }
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
    let value: unknown = this.translations[this.currentLanguage];
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
    return [
      { code: 'en_us', name: 'English (US)' },
      { code: 'zh_cn', name: '中文 (简体)' },
      { code: 'zh_tw', name: '中文 (繁体)' },
    ];
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
