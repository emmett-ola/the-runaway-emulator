/// <reference types="node" />
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { relative, resolve } from 'node:path';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { act, cleanup, render, screen } from '@testing-library/react';
import ts from 'typescript';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { en_us } from './locales/en_us';
import { zh_cn } from './locales/zh_cn';
import { zh_tw } from './locales/zh_tw';
import frozenEn from './__fixtures__/en_us.json';
import frozenCn from './__fixtures__/zh_cn.json';
import frozenTw from './__fixtures__/zh_tw.json';
import { approvedVersionPlaceholder } from './baselineExceptions';
import { i18n, t, useT } from './index';
import { files, scan } from '../../test/i18n-hardcoded-scan';

const translations = { en_us, zh_cn, zh_tw };
const fixtures = { en_us: frozenEn, zh_cn: frozenCn, zh_tw: frozenTw };
type Tree = { [key: string]: string | Tree | string[] };
function flatten(tree: Tree | string[], prefix = ''): Record<string, string> {
  return Object.fromEntries(Object.entries(tree).flatMap(([key, value]) => typeof value === 'string'
    ? [[`${prefix}${key}`, value]] : Object.entries(flatten(value, `${prefix}${key}.`))));
}
const english = flatten(en_us);
const placeholders = (value: string) => [...new Set(Array.from(value.matchAll(/\{([^}]+)\}/g), match => match[1]))].sort();
// Only the shipped provider/protocol names are intentionally identical to English.
const properNouns = ['storage.firebase', 'storage.supabase', 'storage.webdav'];
// Preserve shipped markup, including <strong> (not rewritten to the spec's <b>).
// This documents/tests the existing subset; a shared production rendering helper is deferred.
const markupPaths = ['dashboard.hit_count', 'import_dialog.warning', 'settings.powered_by'];

afterEach(() => {
  cleanup();
  i18n.setLanguage('en_us');
  vi.restoreAllMocks();
});

describe('typed locale parity against committed shipped XML output', () => {
  for (const locale of ['en_us', 'zh_cn', 'zh_tw'] as const) {
    const actual = flatten(translations[locale]);
    const frozen = flatten(fixtures[locale]);
    it(`${locale}: identical full locale key paths and placeholders, with every frozen baseline string byte preserved`, () => {
      expect(Object.keys(actual).sort(), `${locale}: missing/extra key paths`).toEqual(Object.keys(english).sort());
      for (const [key, value] of Object.entries(actual)) {
        expect(placeholders(value), `${locale}:${key}: placeholders`).toEqual(placeholders(english[key]));
      }
      i18n.setLanguage(locale);
      for (const [key, value] of Object.entries(frozen)) {
        expect(Object.hasOwn(actual, key), `${locale}:${key}: missing frozen key`).toBe(true);
        const approved = approvedVersionPlaceholder(key, value);
        expect(actual[key], `${locale}:${key}: changed string`).toBe(approved);
        expect(t(key), `${locale}:${key}: shipped t() output`).toBe(approved);
        const vars = Object.fromEntries(placeholders(approved).map((name, index) => [name, `sample-${index}`]));
        const expected = approved.replace(/\{([^}]+)\}/g, (_, name: string) => vars[name]);
        expect(t(key, vars), `${locale}:${key}: interpolation`).toBe(expected);
      }
      console.log(`${locale}: ${Object.keys(frozen).length} keys; changed-value diff: []`);
    });
    it(`${locale}: CJK / untranslated proper noun contract`, () => {
      if (locale === 'en_us') {
        for (const [key, value] of Object.entries(actual)) expect(value, key).not.toMatch(/[㐀-䶿一-鿿豈-﫿]/);
      } else {
        expect(Object.keys(actual).filter(key => actual[key] === english[key]).sort()).toEqual(properNouns);
      }
    });
    it(`${locale}: markup remains a string with exactly the shipped tags`, () => {
      const paths = Object.keys(actual).filter(key => /<[^>]+>/.test(actual[key]));
      expect(paths.sort()).toEqual([...markupPaths].sort());
      for (const key of paths) {
        expect(typeof actual[key], key).toBe('string');
        expect(actual[key], key).toBe(frozen[key]);
        for (const tag of actual[key].match(/<[^>]+>/g) ?? []) expect(['<strong>', '</strong>', '<br/>'], `${key}:${tag}`).toContain(tag);
      }
      i18n.setLanguage(locale);
      const html = t('dashboard.hit_count', { count: 42 });
      const rendered = renderToStaticMarkup(createElement('span', { dangerouslySetInnerHTML: { __html: html } }));
      expect(rendered).toBe(`<span>${frozen['dashboard.hit_count'].replace('{count}', '42')}</span>`);
      console.log(`${locale} dashboard.hit_count: ${rendered}`);
    });
  }

  it('compiler rejects missing and extra keys at top level and nested levels', () => {
    const reference = resolve('src/lib/i18n/locales/en_us.ts');
    for (const [name, expression] of [
      ['valid', 'en_us'],
      ['missing', '{ ...en_us, dashboard: { title: "only one key" } }'],
      ['extra', '{ ...en_us, unexpected: "extra" }'],
      ['nested extra', '{ ...en_us, dashboard: { ...en_us.dashboard, unexpected: "extra" } }'],
      ['top missing', '(( { dashboard, ...rest } ) => { void dashboard; return rest; })(en_us)'],
    ]) {
      const file = resolve('src/lib/i18n/locales/__type_probe__.ts');
      const source = `import { en_us, type Translations } from './en_us';\nconst probe = ${expression} satisfies Translations;\nvoid probe;`;
      const options: ts.CompilerOptions = { strict: true, noEmit: true, skipLibCheck: true, target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, moduleResolution: ts.ModuleResolutionKind.Bundler, types: [] };
      const host = ts.createCompilerHost(options);
      const read = host.readFile.bind(host);
      const exists = host.fileExists.bind(host);
      host.readFile = path => path === file ? source : read(path);
      host.fileExists = path => path === file || exists(path);
      const program = ts.createProgram([file, reference], options, host);
      const diagnostics = ts.getPreEmitDiagnostics(program);
      const messages = diagnostics.map(d => ts.flattenDiagnosticMessageText(d.messageText, '\n')).join('\n');
      if (name === 'valid') {
        expect(diagnostics, messages).toHaveLength(0);
      } else {
        expect(diagnostics.length, `${name}: ${messages}`).toBeGreaterThan(0);
        expect(diagnostics.every(diagnostic => diagnostic.file?.fileName === file), messages).toBe(true);
        expect(diagnostics.some(diagnostic => [1360, 2353, 2739, 2741].includes(diagnostic.code)), messages).toBe(true);
        console.log(`Compiler rejected ${name}: ${messages}`);
      }
    }
  });

  it('retains the existing hardcoded-copy AST rule and applies it to features/ui', () => {
    const directories = ['src/components', 'src/pages', 'src/features', 'src/ui'].filter(existsSync);
    const sources = directories.flatMap(directory => {
      // Also cover .ts helpers in the target feature/ui directories.
      if (!['src/features', 'src/ui'].includes(directory)) return files(resolve(directory));
      function walk(path: string): string[] {
        return readdirSync(path, { withFileTypes: true }).flatMap(entry => entry.isDirectory()
          ? walk(resolve(path, entry.name)) : /\.tsx?$/.test(entry.name) ? [resolve(path, entry.name)] : []);
      }
      return walk(resolve(directory));
    });
    const findings = sources.flatMap(file => scan(relative(process.cwd(), file), readFileSync(file, 'utf8')));
    expect(findings).toEqual([]);
    expect(scan('example.tsx', '// 中文 comment\nconst x = <img alt="" />;')).toEqual([]);
    expect(scan('example.tsx', 'const x = `中文`; const y = <div>中文<img title="English" alt={"English"} aria-label={`English`} /></div>;')).toHaveLength(5);
    console.log(`Unchanged hardcoded-copy AST rule: ${sources.length} sources; 0 findings; directories: ${directories.join(', ')}`);
  });

  it('preserves fallback, missing variables, language aliases, persistence and subscriptions', () => {
    const callback = vi.fn();
    const unsubscribe = i18n.onLanguageChange(callback);
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(t('missing.key')).toBe('missing.key');
    expect(t('dashboard')).toBe('dashboard');
    expect(warn).toHaveBeenCalledTimes(2);
    expect(t('dashboard.hit_count')).toContain('{count}');
    expect(t('dashboard.hit_count', { count: 0 })).toContain('<strong>0</strong>');
    for (const [input, expected] of [['zh', 'zh_cn'], ['zh_hk', 'zh_tw'], ['en', 'en_us'], ['zh_cn', 'zh_cn'], ['unsupported', 'en_us']] as const) {
      i18n.setLanguage(input);
      expect(i18n.getLanguage()).toBe(expected);
      expect(localStorage.getItem('app-language')).toBe(expected);
    }
    expect(callback).toHaveBeenCalledTimes(5);
    unsubscribe();
    i18n.setLanguage('zh_tw');
    expect(callback).toHaveBeenCalledTimes(5);
  });

  it('useT updates existing mounted state without remounting or losing the open dialog', () => {
    function Probe() {
      const translate = useT();
      return createElement('dialog', { open: true }, createElement('input', { defaultValue: 'retained' }), translate('dashboard.title'));
    }
    const { container } = render(createElement(Probe));
    const input = container.querySelector('input')!;
    input.value = 'edited';
    const dialog = container.querySelector('dialog')!;
    const reload = vi.fn();
    window.addEventListener('beforeunload', reload);
    act(() => i18n.setLanguage('zh_tw'));
    expect(screen.getByText(zh_tw.dashboard.title)).toBeDefined();
    expect(container.querySelector('dialog')).toBe(dialog);
    expect(dialog.open).toBe(true);
    expect(container.querySelector('input')).toBe(input);
    expect(input.value).toBe('edited');
    expect(reload).not.toHaveBeenCalled();
    window.removeEventListener('beforeunload', reload);
  });
});
