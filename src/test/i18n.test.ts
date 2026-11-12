/// <reference types="node" />
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';
import { en_us } from '../i18n/translations/en_us';
import { zh_cn } from '../i18n/translations/zh_cn';
import { zh_tw } from '../i18n/translations/zh_tw';

const translations = { en_us, zh_cn, zh_tw };
const sourceRoot = resolve('src');
type Translation = { [key: string]: string | Translation };
const htmlBaseline: Record<string, Record<string, string>> = JSON.parse(
  readFileSync(resolve(sourceRoot, 'test/i18n-html-baseline.json'), 'utf8'),
);

// Deliberately independent of the generator: XML alone must describe the whole object.
function parseXML(text: string): Translation {
  const document = new DOMParser().parseFromString(text, 'application/xml');
  expect(document.querySelector('parsererror')).toBeNull();
  expect(document.documentElement.tagName).toBe('translations');
  expect(document.doctype).toBeNull();
  function object(element: Element): Translation {
    expect(element.attributes.length).toBe(0);
    const keys = Array.from(element.children, child => child.tagName);
    expect(new Set(keys).size, `Duplicate XML children in ${element.tagName}`).toBe(keys.length);
    for (const node of Array.from(element.childNodes)) {
      expect([1, 3, 4, 8]).toContain(node.nodeType);
      if (element.children.length && (node.nodeType === 3 || node.nodeType === 4)) {
        expect(node.textContent?.trim()).toBe('');
      }
    }
    return Object.fromEntries(Array.from(element.children, child => [
      child.tagName,
      child.children.length ? object(child) : leaf(child),
    ]));
  }
  function leaf(element: Element): string {
    expect(element.attributes.length).toBe(0);
    for (const node of Array.from(element.childNodes)) expect([3, 4, 8]).toContain(node.nodeType);
    return element.textContent ?? '';
  }
  return object(document.documentElement);
}

function sourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const path = resolve(directory, entry.name);
    return entry.isDirectory() ? sourceFiles(path) : /\.[cm]?[jt]sx?$/.test(entry.name) ? [path] : [];
  });
}

function literalCalls(): { file: string; line: number; path: string }[] {
  return sourceFiles(sourceRoot).flatMap(file => {
    const source = ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true);
    const calls: { file: string; line: number; path: string }[] = [];
    function visit(node: ts.Node) {
      if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression)
        && ts.isIdentifier(node.expression.expression) && node.expression.expression.text === 'i18n'
        && node.expression.name.text === 't') {
        const argument = node.arguments[0];
        if (argument && (ts.isStringLiteral(argument) || ts.isNoSubstitutionTemplateLiteral(argument))) {
          calls.push({ file, line: source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1, path: argument.text });
        }
      }
      ts.forEachChild(node, visit);
    }
    visit(source);
    return calls;
  });
}

function lookup(object: Translation, path: string): unknown {
  return path.split('.').reduce<unknown>((value, key) =>
    value !== null && typeof value === 'object' && Object.hasOwn(value, key)
      ? (value as Translation)[key] : undefined, object);
}

describe('i18n XML parity', () => {
  for (const [locale, translation] of Object.entries(translations)) {
    it(`${locale}: XML independently matches every exported key and string`, () => {
      const xml = readFileSync(resolve(sourceRoot, 'i18n', `${locale}.xml`), 'utf8');
      const parsed = parseXML(xml);
      expect(parsed).toEqual(translation);
      for (const path of ['dashboard.hit_count', 'import_dialog.warning'] as const) {
        const expected = htmlBaseline[locale][path];
        expect(typeof lookup(translation, path)).toBe('string');
        expect(lookup(translation, path)).toBe(expected);
        expect(lookup(parsed, path)).toBe(expected);
      }
      function leaves(object: Translation): number {
        return Object.values(object).reduce((count, value) => count + (typeof value === 'string' ? 1 : leaves(value)), 0);
      }
      expect(leaves(parsed)).toBe(leaves(translation));
      console.log(`${locale}: XML ${leaves(parsed)} leaves; exported TS ${leaves(translation)} leaves.`);
    });
  }

  it('every literal i18n.t call in every source file resolves to a string in every locale', () => {
    const calls = literalCalls();
    expect(calls.length).toBeGreaterThan(0);
    for (const { file, line, path } of calls) {
      for (const [locale, translation] of Object.entries(translations)) {
        expect(typeof lookup(translation, path), `${file}:${line} ${locale}:${path}`).toBe('string');
      }
    }
    console.log(`Checked ${calls.length} literal calls (${new Set(calls.map(call => call.path)).size} unique paths) across ${sourceFiles(sourceRoot).length} source files in all 3 locales.`);
  });
});
