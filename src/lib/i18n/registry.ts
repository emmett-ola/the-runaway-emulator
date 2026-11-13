import { en_us, metadata as english } from './locales/en_us';
import { zh_cn, metadata as simplified } from './locales/zh_cn';
import { zh_tw, metadata as traditional } from './locales/zh_tw';
import type { Translations } from './locales/en_us';
import type { LocaleMetadata } from './metadata';

export const locales = {
  en_us: { translations: en_us, metadata: english },
  zh_cn: { translations: zh_cn, metadata: simplified },
  zh_tw: { translations: zh_tw, metadata: traditional },
} satisfies Record<string, { translations: Translations; metadata: LocaleMetadata }>;

export type SupportedLanguage = keyof typeof locales;
export const languageCodes = Object.keys(locales) as SupportedLanguage[];

export function resolveLanguage(language: string): SupportedLanguage {
  const normalized = language.toLowerCase().replace(/_/g, '-');
  return languageCodes.find(code => code.replace(/_/g, '-') === normalized
    || locales[code].metadata.aliases.includes(normalized)) ?? 'en_us';
}

export const getLocaleMetadata = (language: string) => locales[resolveLanguage(language)].metadata;
