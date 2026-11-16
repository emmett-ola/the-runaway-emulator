import { canonicalStringify } from '../../../shared/codec';
import { addRecent, addTimestamp, utcPartition, validateHit } from '../../../shared/run';
export { utcPartition, validateHit } from '../../../shared/run';
import type { Hit } from './model';
import type { Chunk, ChunkDescriptor, Generation, RunIndex } from './state-model';
import { accountPath, descriptor, makeBlob, readFile } from './files';
import { StorageError } from './idb';
import type { BlobRecord } from './state-model';

export const emptyIndex = (accountId: string, revision: string): RunIndex => ({
  accountId, schemaVersion: 1, projectionVersion: 1, sourceRevision: revision, nextOrdinal: 0,
  total: 0, firstAt: null, minAt: null, maxAt: null, chunks: [], hitIds: [], timestamps: [], recent: [],
});
export const chunkPath = (id: string, partition: string, sequence: number): string => `${accountPath(id)}/run/${partition}-${String(sequence).padStart(6, '0')}.json`;
export const appendChunk = async (accountId: string, index: RunIndex, hit: Hit, tail: Chunk | null, revision: string): Promise<{ path: string; blob: BlobRecord; index: RunIndex }> => {
  validateHit(hit);
  const partition = utcPartition(hit.at);
  const previous = index.chunks.filter(chunk => chunk.partition === partition).at(-1);
  const now = Date.now();
  let sequence = previous?.sequence ?? 1;
  const create = (): Chunk => ({ accountId, schemaVersion: 1, recordVersion: revision, createdAt: now, updatedAt: now, partition, sequence, entries: [] });
  let chunk: Chunk = tail ? { ...tail, recordVersion: revision, updatedAt: now, entries: [...tail.entries] } : create();
  const entry = { ordinal: index.nextOrdinal, hit };
  chunk.entries.push(entry);
  let blob = await makeBlob(chunk, revision);
  if (chunk.entries.length > 5000 || blob.length > 1_000_000) {
    if (!tail) throw new StorageError('oversized-hit', 'A hit exceeds the 1,000,000-byte chunk limit.');
    sequence++;
    if (!Number.isSafeInteger(sequence)) throw new StorageError('sequence', 'Chunk sequence exhausted.');
    chunk = create();
    chunk.entries.push(entry);
    blob = await makeBlob(chunk, revision);
    if (blob.length > 1_000_000) throw new StorageError('oversized-hit', 'A hit exceeds the 1,000,000-byte chunk limit.');
  }
  const path = chunkPath(accountId, partition, sequence);
  const ats = chunk.entries.map(value => value.hit.at);
  const summary: ChunkDescriptor = { ...descriptor(path, blob), partition, sequence, count: chunk.entries.length,
    minAt: Math.min(...ats), maxAt: Math.max(...ats), firstOrdinal: chunk.entries[0].ordinal, lastOrdinal: chunk.entries.at(-1)!.ordinal };
  const timestamps = addTimestamp(index.timestamps, hit.at, entry.ordinal);
  return { path, blob, index: { ...index, sourceRevision: revision, nextOrdinal: index.nextOrdinal + 1,
    total: index.total + 1, firstAt: index.firstAt ?? hit.at, minAt: Math.min(index.minAt ?? hit.at, hit.at), maxAt: Math.max(index.maxAt ?? hit.at, hit.at),
    chunks: [...index.chunks.filter(value => value.path !== path), summary], hitIds: [...index.hitIds, hit.id], timestamps,
    recent: addRecent(index.recent, { path, ordinal: entry.ordinal, at: hit.at }) } };
};
export const validateChunk = (chunk: Chunk, expected: ChunkDescriptor, accountId: string): void => {
  if (chunk.accountId !== accountId || chunk.partition !== expected.partition || chunk.sequence !== expected.sequence || chunk.entries.length !== expected.count || !chunk.entries.length || chunk.entries.length > 5000 || expected.bytes > 1_000_000) throw new StorageError('chunk', 'Chunk envelope and index disagree.');
  let prior = -1;
  for (const entry of chunk.entries) {
    validateHit(entry.hit);
    if (!Number.isSafeInteger(entry.ordinal) || entry.ordinal <= prior || utcPartition(entry.hit.at) !== chunk.partition) throw new StorageError('ordinal', 'Invalid ordinal or UTC partition.');
    prior = entry.ordinal;
  }
  const ats = chunk.entries.map(entry => entry.hit.at);
  if (Math.min(...ats) !== expected.minAt || Math.max(...ats) !== expected.maxAt || chunk.entries[0].ordinal !== expected.firstOrdinal || prior !== expected.lastOrdinal) throw new StorageError('chunk-bounds', 'Chunk bounds disagree with the index.');
};
export const validateIndex = (index: RunIndex, accountId: string): void => {
  if (!Array.isArray(index.hitIds) || index.hitIds.length !== index.total || index.hitIds.some(id => typeof id !== 'string' || !id) || new Set(index.hitIds).size !== index.total) throw new StorageError('index-hit-ids', 'Duplicate hit identity or invalid run index hit ids in ordinal order.');
  if (index.accountId !== accountId || index.schemaVersion !== 1 || index.projectionVersion !== 1 || index.total !== index.chunks.reduce((sum, chunk) => sum + chunk.count, 0) || index.total !== index.timestamps.reduce((sum, value) => sum + value.count, 0) || index.nextOrdinal !== index.total || index.recent.length !== Math.min(50, index.total)) throw new StorageError('index', 'Invalid run index totals or ownership.');
  let prior = -Infinity;
  for (const frequency of index.timestamps) {
    utcPartition(frequency.at);
    if (frequency.at <= prior || !Number.isSafeInteger(frequency.count) || frequency.count < 1 || !Number.isSafeInteger(frequency.firstOrdinal) || frequency.firstOrdinal < 0 || frequency.firstOrdinal >= index.total) throw new StorageError('timestamps', 'Invalid exact timestamp projection.');
    prior = frequency.at;
  }
  for (const ref of index.recent) if (!index.chunks.some(chunk => chunk.path === ref.path && ref.ordinal >= chunk.firstOrdinal && ref.ordinal <= chunk.lastOrdinal)) throw new StorageError('recent', 'Recent hit reference is outside its chunk.');
};

/** Verify append-only publication from the verified base, reading changed chunks only. */
export const verifyRunTransition = async (generation: Generation, base: Generation | null, index: RunIndex): Promise<void> => {
  const path = `${accountPath(index.accountId)}/run/index.json`;
  const previous = base?.map[path] ? await readFile<RunIndex>(base, path) : emptyIndex(index.accountId, generation.revision);
  validateIndex(previous, index.accountId);
  const same = (a: unknown, b: unknown): boolean => canonicalStringify(a) === canonicalStringify(b);
  const fail = (): never => { throw new StorageError('index-projection', 'Staged run index is not the exact authoritative chunk projection.'); };
  const oldChunks = new Map(previous.chunks.map(chunk => [chunk.path, chunk]));
  const nextChunks = new Map(index.chunks.map(chunk => [chunk.path, chunk]));
  if (nextChunks.size !== index.chunks.length || previous.chunks.some(chunk => !nextChunks.has(chunk.path))) fail();
  const appended: { path: string; entry: Chunk['entries'][number] }[] = [];
  for (const descriptor of index.chunks) {
    const old = oldChunks.get(descriptor.path);
    if (base?.map[descriptor.path] === generation.map[descriptor.path]) {
      if (!old || !same(old, descriptor)) fail();
      continue;
    }
    const chunk = await readFile<Chunk>(generation, descriptor.path);
    validateChunk(chunk, descriptor, index.accountId);
    let offset = 0;
    if (old && base) {
      const prior = await readFile<Chunk>(base, descriptor.path);
      validateChunk(prior, old, index.accountId);
      offset = prior.entries.length;
      if (chunk.entries.length < offset || !same(chunk.entries.slice(0, offset), prior.entries)) fail();
    }
    for (const entry of chunk.entries.slice(offset)) appended.push({ path: descriptor.path, entry });
  }
  appended.sort((a, b) => a.entry.ordinal - b.entry.ordinal);
  let expected = { ...previous, chunks: index.chunks };
  const ids = new Set(previous.hitIds);
  for (const { path: chunk, entry: { ordinal, hit } } of appended) {
    if (ordinal !== expected.nextOrdinal || ids.has(hit.id)) fail();
    ids.add(hit.id);
    expected = { ...expected, nextOrdinal: ordinal + 1, total: expected.total + 1,
      firstAt: expected.firstAt ?? hit.at, minAt: Math.min(expected.minAt ?? hit.at, hit.at), maxAt: Math.max(expected.maxAt ?? hit.at, hit.at),
      hitIds: [...expected.hitIds, hit.id], timestamps: addTimestamp(expected.timestamps, hit.at, ordinal),
      recent: addRecent(expected.recent, { path: chunk, ordinal, at: hit.at }) };
  }
  if (base?.map[path] !== generation.map[path]) expected.sourceRevision = generation.revision;
  if (!same(expected, index)) fail();
};
