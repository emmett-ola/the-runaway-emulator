import { expect, it, vi } from 'vitest';
import { IDBObjectStore as FakeObjectStore } from 'fake-indexeddb';
import { appendHit, createAccount, ensureRunView, getAccountSnapshot, getRunView, initializeStorage, resetStorage } from './index';
import { getGeneration, readCurrent } from './idb';

it('hydrates no history on reload and fetches only recent-reference chunks for the log view', async () => {
  const receipt = await createAccount('selective');
  if (!receipt.accountId) throw new Error('Missing account UUID.');
  const id = receipt.accountId;
  for (let month = 0; month < 62; month++) await appendHit(id, { id: `month-${month}`, at: Date.UTC(2020, month, 1) });
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
