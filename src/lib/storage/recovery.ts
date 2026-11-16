import { canonicalStringify, decodeCanonical, validateInstant } from '../../../shared/codec';
import { chunkPath, validateChunk, validateIndex } from './chunks';
import { accountPath, moduleFor, validatePath, verifyBlob } from './files';
import { completed, openDatabase, readBlob, request, StorageError, transaction } from './idb';
import { validatePreferences } from './preferences';
import type { Directory, Identity } from './snapshot';
import type { BlobRecord, Chunk, Current, Diagnostic, Envelope, Generation, HitReference, Manifest, Pin, RecoverySnapshot, RunIndex, TimestampFrequency } from './state-model';

const DAY = 86_400_000;
const fail = (message: string): never => { throw new StorageError('recovery-integrity', message); };
const object = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value);
const revision = (generation: Generation): bigint => {
  try { return /^[1-9][0-9]*$/.test(generation.revision) ? BigInt(generation.revision) : -1n; } catch { return -1n; }
};
const newest = (a: Generation, b: Generation): number => revision(a) > revision(b) ? -1 : revision(a) < revision(b) ? 1 : b.createdAt - a.createdAt;
const recentOrder = (a: HitReference, b: HitReference): number => b.at - a.at || a.ordinal - b.ordinal;
const references = (generation: Generation): [string, string][] => generation.map && typeof generation.map === 'object' ? Object.entries(generation.map).filter((entry): entry is [string, string] => typeof entry[1] === 'string' && !!entry[1]) : [];
const same = (a: unknown, b: unknown): boolean => canonicalStringify(a) === canonicalStringify(b);

/** Full audit is for healthy boot/recovery, never a render or ordinary append read. */
export const verifyHealthyGeneration = (generation: Generation): Promise<void> => verifyGeneration(generation, readBlob);
const verifyGeneration = async (generation: Generation, read: (id: string) => Promise<BlobRecord>): Promise<void> => {
  if (generation.state !== 'committed' || revision(generation) < 1n) fail('Recovery requires a committed generation with a valid revision.');
  const load = async <T>(path: string): Promise<T> => {
    validatePath(path);
    const id = generation.map[path];
    if (!id) fail(`Missing file: ${path}`);
    const blob = await read(id);
    if (blob.id !== id) fail(`Blob identity disagrees: ${path}`);
    await verifyBlob(blob);
    return decodeCanonical(blob.bytes) as T;
  };
  const manifest = await load<Manifest>('manifest.json');
  const manifestBlob = await read(generation.map['manifest.json']);
  if (manifestBlob.sha256 !== generation.manifestDigest || manifest.format !== 'runawaylog-files' || manifest.formatVersion !== 1 || manifest.schemaVersion !== 2 || manifest.revision !== generation.revision || manifest.kind !== 'user') fail('Manifest digest, kind or revision disagrees.');
  const listed = ['manifest.json', ...manifest.files.map(file => file.path)].sort();
  if (new Set(listed).size !== listed.length || !same(listed, Object.keys(generation.map).sort())) fail('Manifest and generation membership disagree.');
  for (const file of manifest.files) {
    validatePath(file.path);
    if (file.module !== moduleFor(file.path) || file.schemaVersion !== 1 || !/^[1-9][0-9]*$/.test(file.fileVersion) || BigInt(file.fileVersion) > revision(generation)) fail(`Invalid file descriptor: ${file.path}`);
    const blob = await read(generation.map[file.path]);
    if (blob.id !== generation.map[file.path]) fail(`Blob identity disagrees: ${file.path}`);
    await verifyBlob(blob, file);
    if (!file.path.startsWith('recovery/')) decodeCanonical(blob.bytes);
  }
  const directory = await load<Directory>('shared/accounts.json');
  validatePreferences(await load('device/preferences.json'));
  for (const path of ['shared/extensions.json', 'shared/export-metadata.json']) await load(path);
  if (directory.schemaVersion !== 1 || !/^[1-9][0-9]*$/.test(directory.recordVersion)) fail('Invalid account directory.');
  const ids = new Set<string>(), handles = new Set<string>();
  for (const entry of directory.accounts) {
    const root = accountPath(entry.accountId);
    if (ids.has(entry.accountId) || handles.has(entry.handle)) fail('Duplicate directory account or handle.');
    ids.add(entry.accountId); handles.add(entry.handle);
    const envelope = async <T extends Omit<Envelope, 'payload'>>(path: string): Promise<T> => {
      const value = await load<T>(path);
      if (value.accountId !== entry.accountId || value.schemaVersion !== 1 || !/^[1-9][0-9]*$/.test(value.recordVersion) || BigInt(value.recordVersion) > revision(generation) || !validateInstant(value.createdAt) || !validateInstant(value.updatedAt)) fail(`Invalid account envelope: ${path}`);
      return value;
    };
    const identity = await envelope<Envelope<Identity>>(`${root}/account.json`);
    if (typeof entry.handle !== 'string' || !entry.handle || !validateInstant(entry.registeredAt) || identity.payload.handle !== entry.handle || identity.payload.registeredAt !== entry.registeredAt) fail('Directory and account identity disagree.');
    const profile = await envelope<Envelope<Record<string, unknown>>>(`${root}/profile.json`);
    if (!object(profile.payload) || profile.payload.emailVerification !== 'unverified' || !object(profile.payload.fields) || (Object.hasOwn(profile.payload, 'email') && typeof profile.payload.email !== 'string') || Object.hasOwn(profile, 'emailVerification')) fail('Invalid canonical profile envelope.');
    const settings = await envelope<Envelope<Record<string, unknown>>>(`${root}/settings.json`);
    if (!object(settings.payload) || ['games', 'timezone', 'theme', 'darkMode', 'appearance', 'language', 'calendarTheme', 'mode'].some(key => Object.hasOwn(settings.payload, key))) fail('Account settings contain plugin or device preferences.');
    const games = await envelope<Envelope<Record<string, unknown>> & { pluginId: string }>(`${root}/plugins/games.json`);
    if (games.pluginId !== 'games' || !object(games.payload) || !object(games.payload.settings) || !object(games.payload.cardCollections)) fail('Invalid registered games plugin envelope.');
    for (const suffix of ['extensions.json', 'imports/index.json']) await envelope(`${root}/${suffix}`);
    const index = await load<RunIndex>(`${root}/run/index.json`);
    validateIndex(index, entry.accountId);
    if (!/^[1-9][0-9]*$/.test(index.sourceRevision) || BigInt(index.sourceRevision) > revision(generation)) fail('Invalid index source revision.');
    const ordinals = new Set<number>(), hitIds = new Set<string>(), paths = new Set<string>();
    const orderedIds: string[] = [];
    const frequencies = new Map<number, TimestampFrequency>();
    let recent: HitReference[] = [], firstAt: number | null = null, minAt: number | null = null, maxAt: number | null = null;
    for (const descriptor of index.chunks) {
      const file = manifest.files.find(value => value.path === descriptor.path);
      if (!file || paths.has(descriptor.path) || !Number.isSafeInteger(descriptor.sequence) || descriptor.sequence < 1 || chunkPath(entry.accountId, descriptor.partition, descriptor.sequence) !== descriptor.path || !same(file, Object.fromEntries(Object.keys(file).map(key => [key, descriptor[key as keyof typeof descriptor]])))) fail('Index and manifest chunk descriptors disagree.');
      paths.add(descriptor.path);
      const chunk = await envelope<Chunk>(descriptor.path);
      validateChunk(chunk, descriptor, entry.accountId);
      const refs: HitReference[] = [];
      for (const { ordinal, hit } of chunk.entries) {
        if (ordinals.has(ordinal) || ordinal >= index.total || hitIds.has(hit.id)) fail('Duplicate hit identity or invalid cross-chunk ordinal.');
        ordinals.add(ordinal); hitIds.add(hit.id); orderedIds[ordinal] = hit.id;
        if (ordinal === 0) firstAt = hit.at;
        minAt = Math.min(minAt ?? hit.at, hit.at); maxAt = Math.max(maxAt ?? hit.at, hit.at);
        const frequency = frequencies.get(hit.at);
        if (frequency) { frequency.count++; frequency.firstOrdinal = Math.min(frequency.firstOrdinal, ordinal); }
        else {
        const timestamp = { at: hit.at, count: 1, firstOrdinal: ordinal };
        frequencies.set(hit.at, timestamp);
      }
        refs.push({ path: descriptor.path, ordinal, at: hit.at });
      }
      recent = [...recent, ...refs].sort(recentOrder).slice(0, 50);
    }
    if (manifest.files.filter(file => file.path.startsWith(`${root}/run/`) && file.path !== `${root}/run/index.json`).length !== paths.size || ordinals.size !== index.total || !same(index.hitIds, orderedIds) || index.nextOrdinal !== ordinals.size || index.firstAt !== firstAt || index.minAt !== minAt || index.maxAt !== maxAt || !same(index.timestamps, [...frequencies.values()].sort((a, b) => a.at - b.at)) || !same(index.recent, recent)) fail('Run index is not the exact authoritative chunk projection.');
  }
  for (const path of Object.keys(generation.map)) if (path.startsWith('accounts/') && !ids.has(path.split('/')[1])) fail('Generation contains an unlisted account.');
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
    // Absent/broken publication is not permission to discard interrupted boot evidence.
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
    // A live candidate needs its base even when its base's reader lease elapsed.
    for (const generation of generations) if (roots.has(generation.id) && generation.state === 'staged' && generation.parent) roots.add(generation.parent);
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
  let readableGeneration: string | null = null;
  for (const generation of generations.filter(value => value.state === 'committed').sort(newest)) {
    try {
      if (generation.id === current?.generation && (generation.manifestDigest !== current.manifestDigest || generation.revision !== current.revision)) fail('Current pointer and generation disagree.');
      await verifyGeneration(generation, read);
      readableGeneration = generation.id;
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
  return { diagnostics, current: current ?? null, readableGeneration, readOnly: true, files };
};
