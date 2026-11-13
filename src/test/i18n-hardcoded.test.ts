/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { relative, resolve } from 'node:path';
import { files, scan } from './i18n-hardcoded-scan';
import { describe, expect, it } from 'vitest';

const sources = ['src/components', 'src/pages', 'src/features'].flatMap(directory => files(resolve(directory)));
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
