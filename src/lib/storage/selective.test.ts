import { expect, it, vi } from 'vitest';
import { IDBObjectStore as FakeObjectStore } from 'fake-indexeddb';
import { appendHit, createAccount, ensureRunView, getAccountSnapshot, getRunView, initializeStorage, resetStorage } from './index';
import { importUserData, confirmImportedData } from '../data/transfer';
import { canonicalHit, createArchiveFixture } from '../../test/archive-fixtures';
import { getGeneration, readCurrent } from './idb';

it('does not decode retained import sources during boot statistics or ordinary append', async () => {
  const id = (await createAccount('source-selective')).accountId!;
  const incoming = await importUserData((await createArchiveFixture([{ username: 'source', registeredAt: 0, hits: [canonicalHit('imported', 0)], opaque: [null, 'preserve'] }])).file);
  await confirmImportedData(id, incoming, 'merge');
  const generation = await getGeneration((await readCurrent())!.generation);
  const sources = new Set(Object.entries(generation.map).filter(([path]) => /\/imports\/i-/.test(path)).map(([, blob]) => blob));
  expect(sources.size).toBeGreaterThan(0);
  const reads: string[] = [], realGet = FakeObjectStore.prototype.get;
  const spy = vi.spyOn(FakeObjectStore.prototype, 'get').mockImplementation(function (this: IDBObjectStore, key: IDBValidKey | IDBKeyRange) {
    if (this.name === 'blobs' && typeof key === 'string' && sources.has(key)) reads.push(key);
    return realGet.call(this, key);
  });
  try {
    await resetStorage(); await initializeStorage();
    expect(getAccountSnapshot(id)?.total).toBe(1);
    await ensureRunView(id, 'UTC', '1970-01');
    await appendHit(id, canonicalHit('ordinary', 1));
    expect(reads).toEqual([]);
    expect(getAccountSnapshot(id)?.total).toBe(2);
  } finally { spy.mockRestore(); }
});

it('hydrates no history on reload and fetches only recent-reference chunks for the log view', async () => {
  const receipt = await createAccount('selective');
  if (!receipt.accountId) throw new Error('Missing account UUID.');
  const id = receipt.accountId;
  for (let month = 0; month < 62; month++) await appendHit(id, { id: `month-${month}`, at: Date.UTC(2020, month, 1), schemaVersion: 1, recordVersion: '1' });
  const pointer = await readCurrent();
  if (!pointer) throw new Error('Missing current generation.');
  const generation = await getGeneration(pointer.generation);
  const chunkByBlob = new Map(Object.entries(generation.map).filter(([path]) => /\/run\/y/.test(path)).map(([path, blob]) => [blob, path]));
  const paths: string[] = [];
  const realGet = FakeObjectStore.prototype.get;
  const spy = vi.spyOn(FakeObjectStore.prototype, 'get').mockImplementation(function (this: IDBObjectStore, key: IDBValidKey | IDBKeyRange) {
    if (this.name === 'blobs' && typeof key === 'string' && chunkByBlob.has(key)) paths.push(chunkByBlob.get(key)!);
    return realGet.call(this, key);
  });
  try {
    await resetStorage();
    await initializeStorage();
    expect(paths).toEqual([]);
    const snapshot = getAccountSnapshot(id);
    expect(snapshot?.total).toBe(62);
    expect(snapshot?.index.timestamps).toHaveLength(62);
    expect(paths).toEqual([]);
    const references = new Set(snapshot?.index.recent.map(ref => ref.path));
    await ensureRunView(id, 'UTC', '2025-02');
    expect(getRunView(id, 'UTC', '2025-02')?.recentHits).toHaveLength(50);
    expect(new Set(paths)).toEqual(references);
    expect(new Set(paths).size).toBe(50);
    expect(paths.every(path => !path.includes('y2020-'))).toBe(true);
  } finally { spy.mockRestore(); }
});
