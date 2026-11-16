import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';

const sourceRoot = resolve(import.meta.dirname, '../..');
const files = (directory: string): string[] => readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
  const path = resolve(directory, entry.name);
  return entry.isDirectory() ? files(path) : /\.[jt]sx?$/.test(path) && !/\.test\./.test(path) ? [path] : [];
});
describe('persistence API ownership', () => {
  it('keeps IndexedDB and browser persistence outside components and transfer code', () => {
    for (const file of files(sourceRoot)) {
      if (file.includes('/lib/storage/') || file.includes('/test/')) continue;
      const source = readFileSync(file, 'utf8');
      expect(source, file).not.toMatch(/\b(?:indexedDB|IDBFactory|IDBDatabase|IDBTransaction|IDBObjectStore)\b/);
      expect(source, file).not.toMatch(/\blocalStorage\s*[.[]/);
    }
  });
  it('keeps library storage adapters pointing inward without app/feature imports', () => {
    for (const file of files(resolve(sourceRoot, 'lib'))) {
      const source = readFileSync(file, 'utf8');
      expect(source, file).not.toMatch(/from\s+['"][^'"]*(?:\/features\/|\/app\/)/);
      if (file.includes('/lib/storage/')) expect(source, file).not.toMatch(/from\s+['"]\.\.\/\.\.\/storage['"]/);
    }
  });
});
