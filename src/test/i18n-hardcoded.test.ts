/// <reference types="node" />
import { readFileSync, readdirSync } from 'node:fs';
import { relative, resolve } from 'node:path';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';

type Finding = { file: string; line: number; kind: string; text: string };
const cjk = /[㐀-䶿一-鿿豈-﫿]/;
const checkedAttributes = new Set(['aria-label', 'title', 'alt']);

function scan(file: string, text: string): Finding[] {
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const findings: Finding[] = [];
  function report(node: ts.Node, kind: string, value: string) {
    findings.push({ file, line: source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1, kind, text: value.trim() });
  }
  function visit(node: ts.Node) {
    if ((ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node) || ts.isJsxText(node)) && cjk.test(node.text)) {
      report(node, 'CJK literal', node.text);
    }
    // alt="" is intentionally allowed. placeholder is deliberately unchecked:
    // Profile's your@email.com is a format example, not locale-specific copy.
    if (ts.isJsxAttribute(node) && checkedAttributes.has(node.name.getText(source)) && node.initializer) {
      const value = ts.isJsxExpression(node.initializer) ? node.initializer.expression : node.initializer;
      if (value && (ts.isStringLiteral(value) || ts.isNoSubstitutionTemplateLiteral(value)) && value.text.trim()) {
        report(node, 'literal accessibility attribute', value.text);
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(source);
  return findings;
}

function files(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const file = resolve(directory, entry.name);
    return entry.isDirectory() ? files(file) : entry.name.endsWith('.tsx') ? [file] : [];
  });
}

const sources = ['src/components', 'src/pages'].flatMap(directory => files(resolve(directory)));
const findings = sources.flatMap(file => scan(relative(process.cwd(), file), readFileSync(file, 'utf8')));

describe('i18n hardcoded copy — compiler API inventory', () => {
  it('walks all component/page TSX files and excludes comments by construction', () => {
    expect(sources.length).toBeGreaterThan(0);
    expect(scan('example.tsx', '// 中文 comment\nconst x = <div>{/* 中文 */}<img alt="" /><input placeholder="your@email.com" /></div>;')).toEqual([]);
    expect(scan('example.tsx', 'const x = `中文`; const y = <div>中文<img title="English" alt={"English"} aria-label={`English`} /></div>;')).toHaveLength(5);
    console.log(`AST scanned ${sources.length} TSX files; ${findings.length} findings (comments excluded, empty alt allowed, placeholder unchecked).`);
  });
  for (const finding of findings) {
    it(`${finding.file}:${finding.line} ${finding.kind}: ${JSON.stringify(finding.text)}`, () => {
      expect(finding, `${finding.file}:${finding.line} ${finding.text}`).toBeUndefined();
    });
  }
  it('has no remaining hardcoded CJK or plain accessibility labels', () => {
    expect(findings).toHaveLength(0);
  });
});
