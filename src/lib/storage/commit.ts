import type { BlobRecord, Current, Generation, Manifest, Pin } from './state-model';
import { completed, ConflictError, openDatabase, request, transaction, readCurrent, getGeneration, pinGeneration, releasePin, renewPin, StorageError } from './idb';
import { descriptor, emptyManifest, makeBlob, verifyTree } from './files';

export interface Candidate { generation: Generation; blobs: Map<string, BlobRecord>; deviceId: string; changed: Set<string> }
const verified = new WeakSet<Candidate>();
export const buildCandidate = async (base: Generation | null, changes: ReadonlyMap<string, BlobRecord | null>, deviceId: string): Promise<Candidate> => {
  const revision = String(BigInt(base?.revision ?? '0') + 1n);
  const map = { ...base?.map };
  const blobs = new Map<string, BlobRecord>();
  const changed = new Set<string>();
  let manifest: Manifest = emptyManifest(deviceId, revision);
  if (base) {
    const { readFile } = await import('./files');
    manifest = { ...await readFile<Manifest>(base, 'manifest.json'), revision, exportedAt: Date.now() };
  }
  const descriptors = new Map(manifest.files.map(file => [file.path, file]));
  for (const [path, blob] of changes) {
    if (blob && descriptors.get(path)?.sha256 === blob.sha256 && descriptors.get(path)?.bytes === blob.length) continue;
    changed.add(path);
    if (!blob) { delete map[path]; descriptors.delete(path); continue; }
    map[path] = blob.id;
    blobs.set(blob.id, blob);
    descriptors.set(path, descriptor(path, blob));
  }
  manifest.files = [...descriptors.values()].sort((a, b) => a.path < b.path ? -1 : a.path > b.path ? 1 : 0);
  const manifestBlob = await makeBlob(manifest, revision);
  map['manifest.json'] = manifestBlob.id;
  blobs.set(manifestBlob.id, manifestBlob);
  changed.add('manifest.json');
  return { generation: { id: `${base ? revision : '0'}-${crypto.randomUUID()}`, parent: base?.id ?? null,
    baseRevision: base?.revision ?? '0', revision, state: 'staged', createdAt: Date.now(), map, manifestDigest: manifestBlob.sha256 }, blobs, deviceId, changed };
};
const matchesBase = (current: Current | undefined, candidate: Generation): boolean => candidate.parent === null ? current === undefined : current?.generation === candidate.parent && current.revision === candidate.baseRevision;
const writerPin = (generation: string): Pin => ({ id: `writer-${generation}`, generation, expiresAt: Date.now() + 120_000 });
export const prepare = async (candidate: Candidate): Promise<void> => {
  const db = await openDatabase();
  const tx = transaction(db, 'readwrite');
  const done = completed(tx);
  let conflict = false;
  try {
    const current = await request<Current | undefined>(tx.objectStore('control').get('current'));
    if (!matchesBase(current, candidate.generation)) { conflict = true; tx.abort(); }
    else {
      const collision = await request<Generation | undefined>(tx.objectStore('generations').get(candidate.generation.id));
      if (collision) throw new StorageError('collision', 'Generation id collision.');
      for (const blob of candidate.blobs.values()) tx.objectStore('blobs').add(blob, blob.id);
      tx.objectStore('generations').add(candidate.generation, candidate.generation.id);
      const pin = writerPin(candidate.generation.id);
      tx.objectStore('pins').put(pin, pin.id);
      if (candidate.generation.parent) {
        const basePin = writerPin(candidate.generation.parent);
        basePin.id = `base-${candidate.generation.id}`;
        tx.objectStore('pins').put(basePin, basePin.id);
      }
    }
    await done;
  } catch (error) {
    if (conflict) throw new ConflictError();
    try { tx.abort(); } catch { /* Already completed/aborted. */ }
    await done.catch(() => undefined);
    throw error;
  }
};
export const quarantine = async (id: string): Promise<void> => {
  const db = await openDatabase();
  const tx = transaction(db, 'readwrite');
  const done = completed(tx);
  const candidate = await request<Generation | undefined>(tx.objectStore('generations').get(id));
  if (candidate && candidate.state !== 'committed') tx.objectStore('generations').put({ ...candidate, state: 'quarantined' }, id);
  await done;
};
export const verifyPrepared = async (candidate: Candidate): Promise<void> => {
  try {
    const readback = await getGeneration(candidate.generation.id);
    if (readback.state !== 'staged' || JSON.stringify(readback.map) !== JSON.stringify(candidate.generation.map)) throw new StorageError('staging', 'Staged generation readback differs.');
    await verifyTree(readback, candidate.generation.parent ? candidate.changed : undefined);
    const { hydrateAccount } = await import('./snapshot');
    const { readFile } = await import('./files');
    const { verifyRunTransition } = await import('./chunks');
    const base = readback.parent ? await getGeneration(readback.parent) : null;
    const directory = await readFile<import('./snapshot').Directory>(readback, 'shared/accounts.json');
    for (const entry of directory.accounts) {
      const account = await hydrateAccount(readback, entry.accountId);
      if (account.username !== entry.handle || account.registeredAt !== entry.registeredAt) throw new StorageError('directory', 'Staged directory and identity disagree.');
      await verifyRunTransition(readback, base, account.index);
    }
    verified.add(candidate);
  } catch (error) { await quarantine(candidate.generation.id); throw error; }
};
export const commitPrepared = async (candidate: Candidate): Promise<void> => {
  if (!verified.has(candidate)) throw new StorageError('unverified', 'Candidate readback must verify before publication.');
  const db = await openDatabase();
  const tx = transaction(db, 'readwrite');
  const done = completed(tx);
  let conflict = false;
  try {
    const current = await request<Current | undefined>(tx.objectStore('control').get('current'));
    const staged = await request<Generation | undefined>(tx.objectStore('generations').get(candidate.generation.id));
    if (!matchesBase(current, candidate.generation)) { conflict = true; tx.abort(); }
    else if (!staged || staged.state !== 'staged' || staged.manifestDigest !== candidate.generation.manifestDigest || JSON.stringify(staged.map) !== JSON.stringify(candidate.generation.map)) throw new StorageError('staging', 'Candidate is not verified staged data.');
    else {
      tx.objectStore('generations').put({ ...staged, state: 'committed' }, staged.id);
      tx.objectStore('control').put({ generation: staged.id, revision: staged.revision, manifestDigest: staged.manifestDigest }, 'current');
      if (!current) tx.objectStore('control').add(candidate.deviceId, 'device-id');
      tx.objectStore('pins').delete(`writer-${staged.id}`);
      tx.objectStore('pins').delete(`base-${staged.id}`);
    }
    await done;
  } catch (error) {
    if (conflict) throw new ConflictError();
    try { tx.abort(); } catch { /* Already completed/aborted. */ }
    await done.catch(() => undefined);
    throw error;
  }
};
export const publishCandidate = async (candidate: Candidate): Promise<void> => {
  await prepare(candidate);
  await verifyPrepared(candidate);
  await commitPrepared(candidate);
};
export const withPinnedGeneration = async <T>(operation: (generation: Generation) => Promise<T>, restartable = true): Promise<T> => {
  for (let attempt = 0; attempt < 8; attempt++) {
    const current = await readCurrent();
    if (!current) throw new StorageError('empty', 'No committed account exists.');
    let pin: Pin;
    try { pin = await pinGeneration(current.generation); }
    catch (error) { if (error instanceof StorageError && error.code === 'expired-reader') continue; throw error; }
    let renewal: Promise<void> = Promise.resolve(), leaseError: unknown;
    const timer = setInterval(() => {
      renewal = renewal.then(() => renewPin(pin)).catch(error => { leaseError = error; });
    }, 30_000);
    try {
      const generation = await getGeneration(current.generation);
      if (generation.state !== 'committed' || generation.manifestDigest !== current.manifestDigest) throw new StorageError('current', 'Published pointer is inconsistent.');
      const result = await operation(generation);
      if (restartable) {
        await renewal;
        if (leaseError) throw leaseError;
        await renewPin(pin);
      }
      return result;
    } catch (error) {
      if (restartable && error instanceof StorageError && (error.code === 'expired-reader' || (pin.expiresAt <= Date.now() && ['missing-blob', 'missing-generation'].includes(error.code)))) continue;
      throw error;
    } finally {
      clearInterval(timer);
      await renewal;
      // A committed writer must not be retried or falsely fail on maintenance cleanup.
      if (restartable) await releasePin(pin); else await releasePin(pin).catch(() => undefined);
    }
  }
  throw new StorageError('contention', 'Could not pin a committed generation.');
};
export const getDeviceId = async (): Promise<string | null> => {
  const db = await openDatabase();
  const tx = transaction(db, 'readonly');
  const done = completed(tx);
  const id = await request<string | undefined>(tx.objectStore('control').get('device-id'));
  await done;
  return id ?? null;
};
