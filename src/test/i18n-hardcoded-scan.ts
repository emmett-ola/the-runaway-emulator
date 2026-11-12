/// <reference types="node" />
import { readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import ts from 'typescript';

type Finding = { file: string; line: number; kind: string; text: string };
const cjk = /[㐀-䶿一-鿿豈-﫿]/;
const checkedAttributes = new Set(['aria-label', 'title', 'alt']);

export function scan(file: string, text: string): Finding[] {
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

export function files(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const file = resolve(directory, entry.name);
    return entry.isDirectory() ? files(file) : entry.name.endsWith('.tsx') ? [file] : [];
  });
}
