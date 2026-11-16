import { decodeCanonical } from '../../../shared/codec';
import { accountPath, validatePath, verifyBlob } from './files';
import { completed, getGeneration, openDatabase, pinGeneration, readBlob, releasePin, request, StorageError, transaction } from './idb';
import { readFullFrom, type Directory } from './snapshot';
import { validateCanonicalTree } from './tree-validation';
import type { BlobRecord, Current, Diagnostic, Generation, Manifest, Pin, RecoverySnapshot, RecoveryTree, RunIndex } from './state-model';

const decode = <T>(bytes: Uint8Array): T => decodeCanonical(bytes) as T;
const DAY = 86_400_000;
const fail = (message: string): never => { throw new StorageError('recovery-integrity', message); };
const revision = (generation: Generation): bigint => {
  try { return /^[1-9][0-9]*$/.test(generation.revision) ? BigInt(generation.revision) : -1n; } catch { return -1n; }
};
const newest = (a: Generation, b: Generation): number => revision(a) > revision(b) ? -1 : revision(a) < revision(b) ? 1 : b.createdAt - a.createdAt;
const references = (generation: Generation): [string, string][] => generation.map && typeof generation.map === 'object' ? Object.entries(generation.map).filter((entry): entry is [string, string] => typeof entry[1] === 'string' && !!entry[1]) : [];

/** Complete audit is explicit recovery/transfer work, not a render-time history scan. */
export const verifyHealthyGeneration = (generation: Generation): Promise<void> => verifyGeneration(generation, readBlob);
const verifyGeneration = async (generation: Generation, read: (id: string) => Promise<BlobRecord>): Promise<void> => {
  if (generation.state !== 'committed' || revision(generation) < 1n) fail('Recovery requires a committed generation with a valid revision.');
  if (!generation.map || Array.isArray(generation.map) || references(generation).length !== Object.keys(generation.map).length) fail('Malformed generation map.');
  const files = new Map<string, Uint8Array>();
  const blobs = new Map<string, BlobRecord>();
  for (const [path, id] of references(generation)) {
    validatePath(path);
    const blob = await read(id);
    if (blob.id !== id) fail(`Blob identity disagrees: ${path}`);
    await verifyBlob(blob);
    files.set(path, blob.bytes);
    blobs.set(path, blob);
  }
  const manifestBlob = blobs.get('manifest.json');
  if (!manifestBlob || manifestBlob.sha256 !== generation.manifestDigest) fail('Manifest digest disagrees.');
  const manifest = decode<Manifest>(manifestBlob!.bytes);
  if (manifest.revision !== generation.revision || manifest.kind !== 'user') fail('Manifest kind or revision disagrees.');
  if (!Array.isArray(manifest.files)) fail('Invalid manifest descriptors.');
  for (const file of manifest.files) {
    const blob = blobs.get(file.path);
    if (!blob) fail(`Missing file: ${file.path}`);
    await verifyBlob(blob!, file);
  }
  await validateCanonicalTree(manifest, files);
};

/** Explicit read-only detail access never publishes this older tree as the writable snapshot. */
export const readRecoveryRecord = async (generationId: string, accountId: string) => {
  const pin = await pinGeneration(generationId);
  try {
    const generation = await getGeneration(generationId);
    await verifyHealthyGeneration(generation);
    return await readFullFrom(generation, accountId);
  } finally { await releasePin(pin); }
};

/** Caller gates this on healthy boot/commit; failed recovery/quota never authorizes GC. */
export const garbageCollect = async (): Promise<void> => {
  const db = await openDatabase();
  const tx = transaction(db, 'readwrite'), done = completed(tx);
  try {
    const [current, generations, pins, blobIds] = await Promise.all([
      request<Current | undefined>(tx.objectStore('control').get('current')),
      request<Generation[]>(tx.objectStore('generations').getAll()),
      request<Pin[]>(tx.objectStore('pins').getAll()),
      request(tx.objectStore('blobs').getAllKeys()),
    ]);
    if (!current) { await done; return; }
    const published = generations.find(generation => generation.id === current.generation);
    if (!published) return fail('GC refused an inconsistent current pointer.');
    if (published.state !== 'committed' || published.revision !== current.revision || published.manifestDigest !== current.manifestDigest) fail('GC refused an inconsistent current pointer.');
    const now = Date.now(), roots = new Set([current.generation]), publishedRevision = revision(published);
    generations.filter(generation => generation.state === 'committed' && revision(generation) < publishedRevision).sort(newest).slice(0, 2).forEach(generation => roots.add(generation.id));
    for (const pin of pins) if (pin.expiresAt > now) roots.add(pin.generation);
    const recentStage = (generation: Generation): boolean => generation.state === 'staged' && (!Number.isFinite(generation.createdAt) || generation.createdAt >= now - DAY);
    for (const generation of generations) {
      if (!['committed', 'staged', 'quarantined'].includes(generation.state) || generation.state === 'quarantined' || revision(generation) < 1n || recentStage(generation)) roots.add(generation.id);
    }
    // Quarantine companions retain the untouched original damaged generation too.
    for (const generation of generations) if (roots.has(generation.id) && ['staged', 'quarantined'].includes(generation.state) && generation.parent) roots.add(generation.parent);
    const reachable = new Set<string>();
    for (const generation of generations) {
      if (!generation.map || typeof generation.map !== 'object' || Array.isArray(generation.map) || references(generation).length !== Object.keys(generation.map).length) fail('GC refused malformed generation evidence.');
      if (roots.has(generation.id)) Object.values(generation.map).forEach(id => reachable.add(id));
      else tx.objectStore('generations').delete(generation.id);
    }
    for (const id of blobIds) if (!reachable.has(String(id))) tx.objectStore('blobs').delete(id);
    for (const pin of pins) if (pin.expiresAt <= now) tx.objectStore('pins').delete(pin.id);
    await done;
  } catch (error) {
    try { tx.abort(); } catch { /* Already completed/aborted. */ }
    await done.catch(() => undefined);
    throw error;
  }
};

/** Capture original bytes atomically before validation; damaged bytes never pass through JSON. */
export const readRecoverySnapshot = async (): Promise<RecoverySnapshot> => {
  const db = await openDatabase();
  const tx = transaction(db, 'readonly'), done = completed(tx);
  let current: Current | undefined, generations: Generation[], blobs: Map<string, BlobRecord>;
  try {
    [current, generations] = await Promise.all([
      request<Current | undefined>(tx.objectStore('control').get('current')),
      request<Generation[]>(tx.objectStore('generations').getAll()),
    ]);
    const ids = [...new Set(generations.flatMap(generation => references(generation).map(([, id]) => id)))];
    const values = await Promise.all(ids.map(id => request<BlobRecord | undefined>(tx.objectStore('blobs').get(id))));
    blobs = new Map(ids.flatMap((id, index) => values[index] ? [[id, values[index]!] as const] : []));
    await done;
  } catch (error) { await done.catch(() => undefined); throw error; }
  const diagnostics: Diagnostic[] = [], files: RecoverySnapshot['files'] = [];
  const read = async (id: string): Promise<BlobRecord> => {
    const blob = blobs.get(id);
    if (!blob) throw new StorageError('missing-blob', `Referenced blob is inaccessible: ${id}`);
    return blob;
  };
  let readableGeneration: string | null = null, readableTree: RecoveryTree | null = null;
  // A future/unpublished revision must never masquerade as an older recovery tree.
  const retained = generations.filter(value => value.state === 'committed' && (!current || value.id === current.generation || revision(value) < revision({ ...value, revision: current.revision }))).sort(newest);
  for (const generation of retained) {
    try {
      if (generation.id === current?.generation && (generation.manifestDigest !== current.manifestDigest || generation.revision !== current.revision)) fail('Current pointer and generation disagree.');
      await verifyGeneration(generation, read);
      readableGeneration = generation.id;
      const directory = decode<Directory>((await read(generation.map['shared/accounts.json'])).bytes);
      readableTree = { generation: generation.id, revision: generation.revision, current: generation.id === current?.generation,
        accounts: await Promise.all(directory.accounts.map(async account => ({ ...account,
          total: decode<RunIndex>((await read(generation.map[`${accountPath(account.accountId)}/run/index.json`])).bytes).total,
        }))) };
      break;
    } catch (error) { diagnostics.push({ code: 'unreadable-generation', message: `${generation.id}: ${error instanceof Error ? error.message : String(error)}` }); }
  }
  if (readableGeneration && readableGeneration !== current?.generation) diagnostics.push({ code: 'previous-generation', message: `Read-only previous generation ${readableGeneration}; newer data has not been replaced or promoted.` });
  if (!readableGeneration) diagnostics.push({ code: 'no-readable-generation', message: 'No committed generation verified; only accessible original-byte rescue is available.' });
  if (current && !generations.some(generation => generation.id === current.generation)) diagnostics.push({ code: 'missing-current', message: 'The current generation is missing; publication remains unchanged.' });
  const seen = new Set<string>(), paths = new Set<string>();
  const ordered = [...generations].sort((a, b) => a.id === current?.generation ? -1 : b.id === current?.generation ? 1 : newest(a, b));
  for (const generation of ordered) for (const [originalPath, id] of references(generation)) {
    const reference = JSON.stringify([originalPath, id]);
    if (seen.has(reference)) continue;
    seen.add(reference);
    const blob = blobs.get(id);
    if (!blob?.bytes) { diagnostics.push({ code: 'inaccessible-blob', message: `${generation.id}:${originalPath}: original blob ${id} is inaccessible.` }); continue; }
    let path = originalPath;
    try { validatePath(path); } catch { path = ''; }
    if (!path || paths.has(path)) {
      path = `recovery/${/^[0-9a-f-]+$/.test(id) ? id : crypto.randomUUID()}.bin`;
      while (paths.has(path)) path = `recovery/${crypto.randomUUID()}.bin`;
      diagnostics.push({ code: 'raw-evidence', message: `${generation.id}:${originalPath} (blob ${id}) is preserved at ${path}.` });
    }
    paths.add(path);
    files.push({ path, bytes: new Uint8Array(blob.bytes) });
  }
  return { diagnostics, current: current ?? null, readableGeneration, readableTree, readOnly: true, files };
};
