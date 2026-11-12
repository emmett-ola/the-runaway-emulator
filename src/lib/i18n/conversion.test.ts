import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { en_us as shippedEn } from '../../i18n/translations/en_us';
import { zh_cn as shippedCn } from '../../i18n/translations/zh_cn';
import { zh_tw as shippedTw } from '../../i18n/translations/zh_tw';
import { en_us } from './locales/en_us';
import { zh_cn } from './locales/zh_cn';
import { zh_tw } from './locales/zh_tw';
import frozenEn from './__fixtures__/en_us.json';
import frozenCn from './__fixtures__/zh_cn.json';
import frozenTw from './__fixtures__/zh_tw.json';
import { i18n } from './index';

type Tree = { [key: string]: string | Tree };
function leaves(tree: Tree, prefix = ''): [string, string][] {
  return Object.entries(tree).flatMap(([key, value]) => typeof value === 'string' ? [[`${prefix}${key}`, value] as [string, string]] : leaves(value, `${prefix}${key}.`));
}
describe('pre-deletion XML / shipped / fixture / typed module proof', () => {
  for (const [locale, shipped, frozen, module] of [
    ['en_us', shippedEn, frozenEn, en_us], ['zh_cn', shippedCn, frozenCn, zh_cn], ['zh_tw', shippedTw, frozenTw, zh_tw],
  ] as const) {
    it(`${locale}: every independently decoded XML key/value and shipped t output is frozen`, () => {
      const document = new DOMParser().parseFromString(readFileSync(`src/i18n/${locale}.xml`, 'utf8'), 'application/xml');
      expect(document.querySelector('parsererror')).toBeNull();
      const object = (element: Element): Tree => Object.fromEntries(Array.from(element.children, child => [child.tagName, child.children.length ? object(child) : child.textContent ?? '']));
      expect(object(document.documentElement)).toEqual(shipped);
      expect(frozen).toEqual(shipped);
      expect(module).toEqual(frozen);
      i18n.setLanguage(locale);
      for (const [key, value] of leaves(frozen)) expect(i18n.t(key), `${locale}:${key}`).toBe(value);
      console.log(`${locale}: ${leaves(frozen).length} XML/shipped/fixture/module/t leaves identical`);
    });
  }
});
