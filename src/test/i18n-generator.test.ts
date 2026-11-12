/// <reference types="node" />
// @vitest-environment node
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

const generator = resolve('src/i18n/xml-to-ts.js');
const fixtures: string[] = [];
function fixture() {
  const directory = mkdtempSync(resolve('..', 'i18n-fixture-'));
  fixtures.push(directory);
  mkdirSync(resolve(directory, 'translations'));
  return directory;
}
function locale(directory: string, name: string, xml: string, object = '{ group: { text: "old", retained: "keep" } }') {
  writeFileSync(resolve(directory, `${name}.xml`), xml);
  writeFileSync(resolve(directory, 'translations', `${name}.ts`), `// Keep this comment.\nexport const ${name} = ${object};\n`);
}
function run(directory: string) {
  return spawnSync(process.execPath, [generator, directory], { encoding: 'utf8' });
}
function snapshot(directory: string) {
  return readdirSync(resolve(directory, 'translations')).map(file => {
    const path = resolve(directory, 'translations', file);
    return { file, content: readFileSync(path, 'utf8'), modified: statSync(path, { bigint: true }).mtimeNs };
  });
}

afterEach(() => {
  for (const directory of fixtures.splice(0)) rmSync(directory, { recursive: true });
});

describe('XML generator safety', () => {
  it('merges partial XML, preserves comments and missing keys, and does not rewrite identical files', () => {
    const directory = fixture();
    locale(directory, 'en_us', '<translations><group><text>new</text></group></translations>');
    const first = run(directory);
    expect(first.status, first.stderr).toBe(0);
    expect(first.stdout).toContain('en_us: updated (2 string leaves)');
    expect(readFileSync(resolve(directory, 'translations/en_us.ts'), 'utf8')).toBe(
      '// Keep this comment.\nexport const en_us = { group: { text: "new", retained: "keep" } };\n',
    );
    const before = snapshot(directory);
    const second = run(directory);
    expect(second.status, second.stderr).toBe(0);
    expect(second.stdout).toContain('en_us: unchanged (2 string leaves)');
    expect(snapshot(directory)).toEqual(before);
  });

  it('preserves string whitespace, entities, inline markup, CR, quotes, backslashes, and CDATA bytes', () => {
    const directory = fixture();
    locale(directory, 'en_us', '<translations><group><text>  &lt;strong&gt;{count}&lt;/strong&gt; &amp; " \\ &#13;\n\t </text><retained><![CDATA[  <br/> next\n ]]></retained></group></translations>');
    const result = run(directory);
    expect(result.status, result.stderr).toBe(0);
    const text = readFileSync(resolve(directory, 'translations/en_us.ts'), 'utf8');
    expect(text).toContain(`text: ${JSON.stringify('  <strong>{count}</strong> & " \\ \r\n\t ')}`);
    expect(text).toContain(`retained: ${JSON.stringify('  <br/> next\n ')}`);
  });

  it('preserves empty strings and accepts comments around branch nodes', () => {
    const directory = fixture();
    locale(directory, 'en_us', '<translations><!-- note --><group>\n<text/>\n</group></translations>');
    const result = run(directory);
    expect(result.status, result.stderr).toBe(0);
    expect(readFileSync(resolve(directory, 'translations/en_us.ts'), 'utf8')).toContain('text: ""');
  });

  const invalid = [
    ['duplicate leaf', '<translations><group><text>a</text><text>b</text></group></translations>', 'Duplicate key: group.text'],
    ['duplicate branch', '<translations><group/><group/></translations>', 'Duplicate key: group'],
    ['unknown key', '<translations><group><unknown>x</unknown></group></translations>', 'Unknown key: group.unknown'],
    ['case-sensitive key', '<translations><Group/></translations>', 'Unknown key: Group'],
    ['prototype key', '<translations><__proto__/></translations>', 'Unknown key: __proto__'],
    ['object replacing string', '<translations><group><text><strong>x</strong></text></group></translations>', 'Shape mismatch: group.text must be a string'],
    ['string replacing object', '<translations><group>wrong</group></translations>', 'Shape mismatch: group must be an object'],
    ['empty string replacing object', '<translations><group/></translations>', 'Shape mismatch: group must be an object'],
    ['malformed XML', '<translations><group></translations>', 'Malformed XML'],
    ['unknown entity', '<translations><group><text>&missing;</text></group></translations>', 'Malformed XML'],
    ['trailing document', '<translations/><translations/>', 'Malformed XML'],
    ['wrong root', '<wrong/>', 'Expected <translations> root'],
    ['attributes', '<translations><group><text value="ignored"/></group></translations>', 'Attributes are not supported'],
    ['root attributes', '<translations lang="en"/>', 'Attributes are not supported'],
    ['branch mixed text', '<translations>lost<group><text>x</text></group></translations>', 'Unexpected text'],
    ['processing instruction', '<translations><?ignored data?></translations>', 'Unsupported XML node'],
    ['DTD', '<!DOCTYPE translations [<!ENTITY copy "hidden">]><translations/>', 'DOCTYPE is not supported'],
  ];
  for (const [name, xml, error] of invalid) {
    it(`rejects ${name} before writing any locale (including an earlier valid locale)`, () => {
      const directory = fixture();
      locale(directory, 'aa', '<translations><group><text>changed</text></group></translations>');
      locale(directory, 'zz', xml);
      const before = snapshot(directory);
      const result = run(directory);
      expect(result.status).toBe(1);
      expect(result.stderr).toContain(error);
      expect(result.stdout).not.toContain('updated');
      expect(snapshot(directory)).toEqual(before);
    });
  }

  it('rejects an unknown locale without creating a TS module', () => {
    const directory = fixture();
    writeFileSync(resolve(directory, 'unknown.xml'), '<translations/>');
    const result = run(directory);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('Missing existing translation module: unknown');
    expect(snapshot(directory)).toEqual([]);
  });

  it('rejects duplicate keys in an existing TS module before writing any locale', () => {
    const directory = fixture();
    locale(directory, 'en_us', '<translations/>', '{ group: { text: "one", text: "two" } }');
    const before = snapshot(directory);
    const result = run(directory);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('Duplicate TS key: group.text');
    expect(snapshot(directory)).toEqual(before);
  });
});
