import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';
import ts from 'typescript';

// One-off: independently decode XML, compare shipped TS, then freeze before removal.
const root = new URL('../../', import.meta.url);
const target = new URL('src/lib/i18n/', root);
mkdirSync(new URL('locales/', target), { recursive: true });
mkdirSync(new URL('__fixtures__/', target), { recursive: true });
for (const locale of ['en_us', 'zh_cn', 'zh_tw']) {
  const dom = new JSDOM(readFileSync(new URL(`src/i18n/${locale}.xml`, root), 'utf8'), { contentType: 'application/xml' });
  function object(element) {
    assert.equal(element.attributes.length, 0);
    const keys = [...element.children].map(child => child.tagName);
    assert.equal(new Set(keys).size, keys.length);
    return Object.fromEntries([...element.children].map(child => [child.tagName, child.children.length ? object(child) : child.textContent]));
  }
  assert.equal(dom.window.document.documentElement.tagName, 'translations');
  const tree = object(dom.window.document.documentElement);
  dom.window.close();
  const source = readFileSync(new URL(`src/i18n/translations/${locale}.ts`, root), 'utf8');
  const javascript = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext } }).outputText;
  const shipped = (await import(`data:text/javascript;base64,${Buffer.from(javascript).toString('base64')}`))[locale];
  assert.deepEqual(tree, shipped, `${locale}: XML vs shipped TS`);
  writeFileSync(new URL(`__fixtures__/${locale}.json`, target), JSON.stringify(tree, null, 2) + '\n');
  const prefix = locale === 'en_us' ? '' : "import type { Translations } from './en_us';\n\n";
  const suffix = locale === 'en_us' ? ';\n\nexport type Translations = typeof en_us;\n' : ' satisfies Translations;\n';
  writeFileSync(new URL(`locales/${locale}.ts`, target), `${prefix}export const ${locale} = ${JSON.stringify(tree, null, 2)}${suffix}`);
  console.log(`${locale}: XML === shipped TS === frozen fixture; conversion preserves all values`);
}
