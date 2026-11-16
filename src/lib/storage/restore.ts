import { serializeStorageOperation, notifyCommitted } from './commands';
import { type Candidate, commitPrepared, getDeviceId, prepare, quarantine, verifyPrepared } from './commit';
import { descriptor, emptyManifest, makeBlob, readFile } from './files';
import { completed, ConflictError, getGeneration, openDatabase, pinGeneration, readCurrent, releasePin, request, StorageError, transaction } from './idb';
import { verifyHealthyGeneration } from './recovery';
import { publishGeneration } from './snapshot';
import type { BlobRecord, CommitReceipt, Current, Generation, RunIndex } from './state-model';

const positiveVersion = (value: string): bigint => {
  if (!/^[1-9][0-9]*$/.test(value)) throw new StorageError('recovery-version', 'Cannot safely advance an invalid local version counter.');
  return BigInt(value);
};
const sameCurrent = (a: Current | null, b: Current | null): boolean => a?.generation === b?.generation && a?.revision === b?.revision && a?.manifestDigest === b?.manifestDigest;

/** Preserve a separate quarantine root, never alter or promote the damaged generation. */
const preserveEvidence = async (current: Current, generations: Generation[], sourceRevision: string): Promise<void> => {
  const tx = transaction(await openDatabase(), 'readwrite'), done = completed(tx);
  try {
    const actual = await request<Current | undefined>(tx.objectStore('control').get('current'));
    if (!sameCurrent(actual ?? null, current)) throw new ConflictError();
    const newer = generations.filter(generation => generation.state === 'committed' && /^[1-9][0-9]*$/.test(generation.revision) && BigInt(generation.revision) > positiveVersion(sourceRevision));
    if (!newer.some(generation => generation.id === current.generation)) newer.push({ id: current.generation, revision: current.revision, map: {}, manifestDigest: current.manifestDigest, state: 'committed', createdAt: Date.now(), parent: null, baseRevision: '0' });
    for (const damaged of newer) {
      const evidence: Generation = { ...damaged, id: `recovery-evidence-${crypto.randomUUID()}`, parent: damaged.id,
        state: 'quarantined', createdAt: Date.now(), map: { ...damaged.map } };
      tx.objectStore('generations').add(evidence, evidence.id);
    }
    await done;
  } catch (error) {
    try { tx.abort(); } catch { /* Already settled. */ }
    await done.catch(() => undefined);
    throw error;
  }
};

const recoveryCandidate = async (source: Generation, current: Current, deviceId: string): Promise<Candidate> => {
  const tx = transaction(await openDatabase(), 'readonly'), done = completed(tx);
  const [generations, storedBlobs] = await Promise.all([
    request<Generation[]>(tx.objectStore('generations').getAll()), request<BlobRecord[]>(tx.objectStore('blobs').getAll()),
  ]);
  await done;
  let next = positiveVersion(current.revision);
  for (const generation of generations) if (/^[1-9][0-9]*$/.test(generation.revision)) next = next > BigInt(generation.revision) ? next : BigInt(generation.revision);
  for (const blob of storedBlobs) if (/^[1-9][0-9]*$/.test(blob.fileVersion)) next = next > BigInt(blob.fileVersion) ? next : BigInt(blob.fileVersion);
  const revision = String(next + 1n), blobs = new Map<string, BlobRecord>(), map: Record<string, string> = {};
  const byPath = new Map<string, BlobRecord>();
  const store = async (path: string, value: unknown): Promise<void> => {
    const blob = await makeBlob(value, revision);
    byPath.set(path, blob); blobs.set(blob.id, blob); map[path] = blob.id;
  };
  const indexes: [string, RunIndex][] = [];
  for (const path of Object.keys(source.map)) {
    if (path === 'manifest.json') continue;
    const value = await readFile<unknown>(source, path);
    if (/\/run\/index\.json$/.test(path)) { indexes.push([path, value as RunIndex]); continue; }
    if (path.startsWith('accounts/')) {
      const entity = value as Record<string, unknown>;
      const restored = { ...entity, recordVersion: revision };
      // Hit versions are preserved authority-scoped facts, not local file counters.
      // Raising a chunk's local version must not rewind an imported hit version.
      await store(path, restored);
    } else if (path === 'shared/accounts.json') await store(path, { ...value as Record<string, unknown>, recordVersion: revision });
    else await store(path, value);
  }
  for (const [path, index] of indexes) {
    const chunks = index.chunks.map(chunk => ({ ...chunk, ...descriptor(chunk.path, byPath.get(chunk.path)!) }));
    await store(path, { ...index, sourceRevision: revision, chunks });
  }
  const manifest = { ...emptyManifest(deviceId, revision), files: [...byPath].map(([path, blob]) => descriptor(path, blob)).sort((a, b) => a.path < b.path ? -1 : 1) };
  const manifestBlob = await makeBlob(manifest, revision);
  blobs.set(manifestBlob.id, manifestBlob); map['manifest.json'] = manifestBlob.id;
  await preserveEvidence(current, generations, source.revision);
  return { generation: { id: `${revision}-${crypto.randomUUID()}`, parent: current.generation, baseRevision: current.revision,
    revision, state: 'staged', createdAt: Date.now(), map, manifestDigest: manifestBlob.sha256 },
    deviceId, blobs, changed: new Set(Object.keys(map)), fullValidation: true };
};

/** Explicit consent publishes a NEW generation; stale consent is never silently rebased. */
export const restoreRecoveryGeneration = (generationId: string, confirmed: boolean, expectedCurrent?: Current | null): Promise<CommitReceipt> => {
  if (!confirmed) return Promise.reject(new StorageError('recovery-confirmation', 'Explicit recovery confirmation is required.'));
  return serializeStorageOperation(async () => {
    const current = await readCurrent();
    if (!current || (expectedCurrent !== undefined && !sameCurrent(current, expectedCurrent))) throw new StorageError('recovery-stale', 'The current generation changed; inspect recovery again before confirming.');
    const source = await getGeneration(generationId);
    if (generationId === current.generation || positiveVersion(source.revision) >= positiveVersion(current.revision)) throw new StorageError('recovery-source', 'Select a verified older committed generation.');
    const deviceId = await getDeviceId();
    if (!deviceId) throw new StorageError('recovery-device', 'Installation identity is inaccessible; recovery cannot replace it.');
    const pin = await pinGeneration(source.id);
    let candidate: Candidate | undefined;
    try {
      await verifyHealthyGeneration(source);
      candidate = await recoveryCandidate(source, current, deviceId);
      await prepare(candidate);
      await verifyPrepared(candidate);
      await commitPrepared(candidate);
      const committed = await getGeneration(candidate.generation.id);
      await publishGeneration(committed);
      notifyCommitted();
      return { generation: committed.id, revision: committed.revision };
    } catch (error) {
      if (candidate) await quarantine(candidate.generation.id).catch(() => undefined);
      throw error;
    } finally { await releasePin(pin).catch(() => undefined); }
  });
};
