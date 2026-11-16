import { describe, expect, it, vi } from 'vitest';
import { IDBObjectStore } from 'fake-indexeddb';
import { appendHit, createAccount, getAccountSnapshot, readFullRecord } from './index';
import { buildCandidate, prepare, verifyPrepared } from './commit';
import { accountPath, makeBlob, readFile } from './files';
import { getGeneration, readCurrent } from './idb';
import { verifyHealthyGeneration } from './recovery';
import type { Manifest, RunIndex } from './state-model';

const currentGeneration = async () => getGeneration((await readCurrent())!.generation);
const account = async () => (await createAccount('integrity')).accountId!;

describe('command identity and staged projection integrity', () => {
  it('rejects duplicate ids across changed timestamps and UTC partitions without changing current', async () => {
    const id = await account();
    await appendHit(id, { id: 'stable', at: 0 });
    const before = await readCurrent();
    for (const at of [1, Date.UTC(2026, 10, 1)]) {
      await expect(appendHit(id, { id: 'stable', at })).rejects.toMatchObject({ code: 'duplicate-hit' });
      expect(await readCurrent()).toEqual(before);
    }
    await appendHit(id, { id: 'safe-retry', at: 1 });
    expect((await readFullRecord(id)).hits.map(hit => hit.id)).toEqual(['stable', 'safe-retry']);
    await expect(verifyHealthyGeneration(await currentGeneration())).resolves.toBeUndefined();
  });

  it('rejects historical ids outside recent fifty using the index without fetching old chunks', async () => {
    const id = await account();
    await appendHit(id, { id: 'historical', at: 0 });
    for (let index = 0; index < 51; index++) await appendHit(id, { id: `recent-${index}`, at: Date.UTC(2026, 10, 1) + index });
    const generation = await currentGeneration();
    const oldChunk = generation.map[`${accountPath(id)}/run/y1970-m01-000001.json`];
    const get = vi.spyOn(IDBObjectStore.prototype, 'get');
    try {
      await expect(appendHit(id, { id: 'historical', at: Date.UTC(2027, 0, 1) })).rejects.toMatchObject({ code: 'duplicate-hit' });
      expect(get.mock.calls.some(([key]) => key === oldChunk)).toBe(false);
      await appendHit(id, { id: 'new-partition', at: Date.UTC(2027, 0, 1) });
      expect(get.mock.calls.some(([key]) => key === oldChunk)).toBe(false);
    } finally { get.mockRestore(); }
    expect(getAccountSnapshot(id)?.index.hitIds[0]).toBe('historical');
  });

  it('quarantines correctly rehashed false timestamp, bounds and recent projections before publication', async () => {
    const id = await account();
    await appendHit(id, { id: 'one', at: 0 });
    const base = await currentGeneration();
    const before = await readCurrent();
    const path = `${accountPath(id)}/run/index.json`;
    const index = await readFile<RunIndex>(base, path);
    const manifest = await readFile<Manifest>(base, 'manifest.json');
    const forgeries = [
      { ...index, timestamps: [{ ...index.timestamps[0], at: 1 }] },
      { ...index, firstAt: 1 },
      { ...index, minAt: -1 },
      { ...index, maxAt: 1 },
      { ...index, recent: [{ ...index.recent[0], at: 1 }] },
      { ...index, hitIds: ['invented'] },
    ];
    for (const value of forgeries) {
      const candidate = await buildCandidate(base, new Map([[path, await makeBlob({ ...value, sourceRevision: '3' }, '3')]]), manifest.deviceId);
      await prepare(candidate);
      await expect(verifyPrepared(candidate)).rejects.toMatchObject({ code: 'index-projection' });
      expect((await getGeneration(candidate.generation.id)).state).toBe('quarantined');
      expect(await readCurrent()).toEqual(before);
    }
  });
});
