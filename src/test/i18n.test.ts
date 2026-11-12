/// <reference types="node" />
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';
import { en_us } from '../lib/i18n/locales/en_us';
import { zh_cn } from '../lib/i18n/locales/zh_cn';
import { zh_tw } from '../lib/i18n/locales/zh_tw';

const translations = { en_us, zh_cn, zh_tw };
const sourceRoot = resolve('src');
type Translation = { [key: string]: string | Translation };
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

describe('i18n shipped fixture parity', () => {
  for (const [locale, translation] of Object.entries(translations)) {
    it(`${locale}: frozen XML output matches every exported key and string`, () => {
      const frozen: Translation = JSON.parse(readFileSync(resolve(sourceRoot, 'lib/i18n/__fixtures__', `${locale}.json`), 'utf8'));
      expect(translation).toEqual(frozen);
      for (const path of ['dashboard.hit_count', 'import_dialog.warning']) {
        expect(typeof lookup(translation, path)).toBe('string');
        expect(lookup(translation, path)).toBe(lookup(frozen, path));
      }
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
