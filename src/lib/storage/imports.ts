import { canonicalStringify, encodeCanonical, sha256 } from '../../../shared/codec';
import { addRecent } from '../../../shared/run';
import { emptyIndex, chunkPath, utcPartition, validateHit } from './chunks';
import { enqueue, envelope, resolveAccount } from './commands';
import { accountPath, descriptor, makeBlob, readFile } from './files';
import { StorageError } from './idb';
import { blockStorage, readFullFrom } from './snapshot';
import { encodeImportSource } from './source-codec';
import type { Hit } from './model';
import type { BlobRecord, Chunk, Envelope, RunIndex, TimestampFrequency } from './state-model';

export interface ImportSource { accountId: string; files: Record<string, unknown>; shared: Record<string, unknown> }
export interface ImportIntent { hits: readonly Hit[]; sources: readonly ImportSource[] }
export interface ImportEntry { importId: string; path: string; sourceDigest: string }

/** Full-record transfer rebuilds bounded chunks once, not a quadratic append command loop. */
const materializeHits = async (id: string, hits: readonly Hit[], revision: string): Promise<Map<string, BlobRecord | null>> => {
  const changes = new Map<string, BlobRecord | null>(), index = emptyIndex(id, revision);
  const frequencies = new Map<number, TimestampFrequency>();
  const partitions = new Map<string, { ordinal: number; hit: Hit }[]>();
  for (const [ordinal, hit] of hits.entries()) {
    validateHit(hit);
    const partition = utcPartition(hit.at), entries = partitions.get(partition) ?? [];
    entries.push({ ordinal, hit }); partitions.set(partition, entries);
    const frequency = frequencies.get(hit.at);
    if (frequency) frequency.count++;
    else frequencies.set(hit.at, { at: hit.at, count: 1, firstOrdinal: ordinal });
  }
  const now = Date.now();
  for (const [partition, entries] of partitions) {
    let sequence = 1;
    const create = (): Chunk => ({ accountId: id, schemaVersion: 1, recordVersion: revision, createdAt: now, updatedAt: now, partition, sequence, entries: [] });
    let chunk = create(), bytes = encodeCanonical(chunk).byteLength;
    const save = async (): Promise<void> => {
      const path = chunkPath(id, partition, sequence), blob = await makeBlob(chunk, revision);
      if (blob.length !== bytes || blob.length > 1_000_000) throw new StorageError('chunk', 'Rebuilt chunk byte accounting disagrees.');
      changes.set(path, blob);
      const ats = chunk.entries.map(entry => entry.hit.at);
      index.chunks.push({ ...descriptor(path, blob), partition, sequence, count: chunk.entries.length,
        minAt: Math.min(...ats), maxAt: Math.max(...ats), firstOrdinal: chunk.entries[0].ordinal, lastOrdinal: chunk.entries.at(-1)!.ordinal });
      for (const { ordinal, hit } of chunk.entries) index.recent = addRecent(index.recent, { path, ordinal, at: hit.at });
    };
    for (const entry of entries) {
      const entryBytes = encodeCanonical(entry).byteLength;
      if (chunk.entries.length && (chunk.entries.length === 5000 || bytes + 1 + entryBytes > 1_000_000)) {
        await save(); sequence++; chunk = create(); bytes = encodeCanonical(chunk).byteLength;
      }
      bytes += entryBytes + (chunk.entries.length ? 1 : 0);
      if (bytes > 1_000_000) throw new StorageError('oversized-hit', 'A hit exceeds the 1,000,000-byte chunk limit.');
      chunk.entries.push(entry);
    }
    if (chunk.entries.length) await save();
  }
  index.total = index.nextOrdinal = hits.length;
  index.hitIds = hits.map(hit => hit.id);
  index.firstAt = hits[0]?.at ?? null;
  index.minAt = hits[0]?.at ?? null; index.maxAt = hits.at(-1)?.at ?? null;
  index.timestamps = [...frequencies.values()].sort((a, b) => a.at - b.at);
  changes.set(`${accountPath(id)}/run/index.json`, await makeBlob(index, revision));
  return changes;
};

/** Confirmation is queued intent, not a stale whole-account save. UUID is mandatory. */
export const importHits = (id: string, incoming: ImportIntent, mode: 'merge' | 'replace') => {
  const intent = structuredClone(incoming);
  return enqueue(async (base, revision) => {
    if (mode !== 'merge' && mode !== 'replace') throw new StorageError('import-mode', 'Choose merge or replace explicitly.');
    const { base: generation, root } = await resolveAccount(base, id);
    const { verifyHealthyGeneration } = await import('./recovery');
    try { await verifyHealthyGeneration(generation); }
    catch (error) { blockStorage(error); throw error; }
    const current = await readFullFrom(generation, id);
    const incomingIds = new Map<string, string>();
    for (const hit of intent.hits) {
      validateHit(hit);
      const encoded = canonicalStringify(hit), prior = incomingIds.get(hit.id);
      if (prior !== undefined && prior !== encoded) throw new StorageError('duplicate-hit', 'Conflicting incoming duplicate hit identity.');
      incomingIds.set(hit.id, encoded);
    }
    const hits = mode === 'merge' ? [...current.hits] : [];
    const ids = new Set(hits.map(hit => hit.id));
    for (const hit of intent.hits) if (!ids.has(hit.id)) { hits.push(hit); ids.add(hit.id); }
    hits.sort((a, b) => a.at - b.at);
    const changes = canonicalStringify(hits) === canonicalStringify(current.hits)
      ? new Map<string, BlobRecord | null>() : await materializeHits(id, hits, revision);
    if (changes.size) {
      const old = await readFile<RunIndex>(generation, `${root}/run/index.json`);
      for (const chunk of old.chunks) if (!changes.has(chunk.path)) changes.set(chunk.path, null);
    }
    const path = `${root}/imports/index.json`, previous = await readFile<Envelope<ImportEntry[]>>(generation, path);
    if (!Array.isArray(previous.payload)) throw new StorageError('imports', 'Invalid import source directory.');
    const entries = [...previous.payload], digests = new Set(entries.map(entry => entry.sourceDigest));
    let sequence = entries.reduce((max, entry) => Math.max(max, Number(entry.importId.slice(2))), 0);
    for (const source of intent.sources) for (const payload of await encodeImportSource(source)) {
      const sourceDigest = await sha256(encodeCanonical(payload));
      if (digests.has(sourceDigest)) continue;
      if (!Number.isSafeInteger(++sequence)) throw new StorageError('imports', 'Import sequence exhausted.');
      const importId = `i-${String(sequence).padStart(8, '0')}`, sourcePath = `${root}/imports/${importId}.json`;
      entries.push({ importId, path: sourcePath, sourceDigest }); digests.add(sourceDigest);
      changes.set(sourcePath, await makeBlob({ ...envelope(id, payload, revision), importId, sourceDigest }, revision));
    }
    if (entries.length !== previous.payload.length) changes.set(path, await makeBlob({ ...previous, payload: entries, recordVersion: revision, updatedAt: Date.now() }, revision));
    return { accountId: id, changes, fullValidation: true };
  });
};
