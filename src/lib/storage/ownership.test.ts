import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const sourceRoot = resolve(import.meta.dirname, '../..');
const sharedRoot = resolve(sourceRoot, '../shared');
const files = (directory: string): string[] => readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
  const path = resolve(directory, entry.name);
  return entry.isDirectory() ? files(path) : /\.[jt]sx?$/.test(path) && !/\.test\./.test(path) ? [path] : [];
});
const imports = (source: string): string[] => [...source.matchAll(/(?:\bfrom\s*|\bimport\s*\(\s*|\bimport\s*)['"]([^'"]+)['"]/g)].map(match => match[1]);
describe('persistence API ownership', () => {
  it('keeps IndexedDB and browser persistence outside components and transfer code', () => {
    for (const file of files(sourceRoot)) {
      if (file.includes('/lib/storage/') || file.includes('/test/')) continue;
      const source = readFileSync(file, 'utf8');
      expect(source, file).not.toMatch(/\b(?:indexedDB|IDBFactory|IDBDatabase|IDBTransaction|IDBObjectStore)\b/);
      expect(source, file).not.toMatch(/\b(?:localStorage|sessionStorage)\s*[.[]/);
    }
  });
  it('keeps library storage adapters pointing inward without app/feature imports', () => {
    for (const file of files(resolve(sourceRoot, 'lib'))) {
      const source = readFileSync(file, 'utf8');
      expect(source, file).not.toMatch(/from\s+['"][^'"]*(?:\/features\/|\/app\/)/);
      if (file.includes('/lib/storage/')) expect(source, file).not.toMatch(/from\s+['"]\.\.\/\.\.\/storage['"]/);
    }
  });
  it('keeps transfer and features on the public storage facade and forbids cross-feature deep imports', () => {
    for (const file of files(sourceRoot)) {
      const feature = file.split('/features/')[1]?.split('/')[0];
      if (!feature && !file.includes('/lib/data/')) continue;
      for (const specifier of imports(readFileSync(file, 'utf8'))) {
        if (!specifier.startsWith('.')) continue;
        const target = resolve(dirname(file), specifier);
        if (target.startsWith(resolve(sourceRoot, 'lib/storage'))) expect(target, `${file}: ${specifier}`).toMatch(/\/lib\/storage(?:\/index)?$/);
        const targetFeature = target.split('/features/')[1];
        if (feature && targetFeature && targetFeature.split('/')[0] !== feature) expect(targetFeature, `${file}: ${specifier}`).toMatch(/^[^/]+(?:\/index)?$/);
      }
    }
  });
  it('keeps shared canonical models codecs and selectors independent of persistence and application runtime', () => {
    for (const file of files(sharedRoot)) {
      const source = readFileSync(file, 'utf8');
      expect(source, file).not.toMatch(/\b(?:indexedDB|IDBFactory|IDBDatabase|IDBTransaction|IDBObjectStore|localStorage|sessionStorage)\b/);
      for (const specifier of imports(source)) if (specifier.startsWith('.')) expect(resolve(dirname(file), specifier), file).toMatch(new RegExp(`^${sharedRoot.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}/`));
    }
  });
});
