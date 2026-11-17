import { describe, expect, it } from 'vitest';
import { en_us } from './en_us';
import { zh_cn } from './zh_cn';
import { zh_tw } from './zh_tw';

const locales = { en_us, zh_cn, zh_tw };
const approved = {
  en_us: {
    rules: 'At least 6 characters', short: 'At least 6 characters',
    long: 'Password is too long', invalid: 'Password contains invalid characters',
    notice: 'Your password stays on this device and cannot be recovered.',
  },
  zh_cn: {
    rules: '至少 6 位字符', short: '密码至少 6 位', long: '密码过长', invalid: '密码包含无效字符',
    notice: '密码仅保存在此设备上，无法找回。',
  },
  zh_tw: {
    rules: '至少 6 位字元', short: '至少 6 位字元', long: '密碼過長', invalid: '密碼包含無效字元',
    notice: '密碼僅儲存在此裝置上，無法找回。',
  },
};
function strings(tree: object, prefix = ''): [string, string][] {
  return Object.entries(tree).flatMap(([key, value]) => typeof value === 'string'
    ? [[`${prefix}${key}`, value] as [string, string]] : strings(value, `${prefix}${key}.`));
}

describe('plain user-visible password copy', () => {
  for (const locale of ['en_us', 'zh_cn', 'zh_tw'] as const) {
    it(`${locale}: every locale string is free of encoding jargon, including release notes`, () => {
      for (const [key, value] of strings(locales[locale])) {
        expect(value, key).not.toMatch(/unicode|码点|碼點|码元|碼元|utf[\s-]?8|code[\s-]?points?|code[\s-]?units?/i);
      }
    });
    it(`${locale}: rules, policy errors and the single local-only loss notice match exact approved copy`, () => {
      const login = locales[locale].login, expected = approved[locale];
      expect(login.password_rules).toBe(expected.rules);
      expect(login.error.password_too_short).toBe(expected.short);
      expect(login.error.password_too_long).toBe(expected.long);
      expect(login.error.password_invalid_unicode).toBe(expected.invalid);
      expect(login.setup_notice).toBe(expected.notice);
      expect(Object.hasOwn(login, 'device_notice')).toBe(false);
    });
  }
});
