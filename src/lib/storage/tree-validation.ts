import { canonicalStringify, decodeCanonical, encodeCanonical, sha256, validateInstant } from '../../../shared/codec';
import { chunkPath, validateChunk, validateIndex } from './chunks';
import { ACCOUNT_ID, accountPath, moduleFor, validatePath } from './files';
import { canonicalFailure as fail, isObject, isVersion, validateEnvelope, validateGames, validateIdentity, validateProfile, validateSettings } from './envelope-validation';
import { validatePreferences } from './preferences';
import { decodeImportSources } from './source-codec';
import type { Directory, Identity } from './snapshot';
import type { Chunk, Envelope, FileDescriptor, HitReference, Manifest, RunIndex, TimestampFrequency } from './state-model';

const same = (a: unknown, b: unknown): boolean => canonicalStringify(a) === canonicalStringify(b);
const hash = (value: unknown): value is string => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
const recentOrder = (a: HitReference, b: HitReference): number => b.at - a.at || a.ordinal - b.ordinal;
interface SourceEntry { importId: string; path: string; sourceDigest: string }
interface SourceEnvelope extends Envelope { importId: string; sourceDigest: string }
export interface CanonicalTreeOptions { import?: boolean }
export type CanonicalFileReader = (path: string) => Promise<Uint8Array>;
const PAYLOAD_LIMIT = 16 * 1024 * 1024;

export const validateManifest = (manifest: Manifest): void => {
  if (!isObject(manifest) || manifest.format !== 'runawaylog-files' || manifest.formatVersion !== 1 || manifest.schemaVersion !== 2 || manifest.kind !== 'user' || !isVersion(manifest.revision) || typeof manifest.appVersion !== 'string' || !manifest.appVersion || typeof manifest.deviceId !== 'string' || !manifest.deviceId || !validateInstant(manifest.exportedAt) || (manifest.accountId !== null && !ACCOUNT_ID.test(manifest.accountId)) || !isObject(manifest.auth) || manifest.auth.algorithm !== null || manifest.auth.keyId !== null || manifest.auth.signature !== null || !Array.isArray(manifest.files)) fail('Unsupported canonical manifest, auth or selected account.');
  canonicalStringify(manifest);
};
export const validateDescriptor = (file: FileDescriptor, revision: string): void => {
  if (!isObject(file) || typeof file.path !== 'string') fail('Invalid manifest file descriptor.');
  validatePath(file.path);
  if (file.path === 'manifest.json' || file.path.startsWith('recovery/') || file.module !== moduleFor(file.path) || file.schemaVersion !== 1 || !isVersion(file.fileVersion) || BigInt(file.fileVersion) > BigInt(revision) || !Number.isSafeInteger(file.bytes) || file.bytes < 0 || !hash(file.sha256)) fail('Invalid registered file descriptor.');
};
const validateImports = async (root: string, id: string, revision: string, load: <T>(path: string) => Promise<T>, descriptors: ReadonlyMap<string, FileDescriptor>): Promise<void> => {
  const index = await load<Envelope<SourceEntry[]>>(`${root}/imports/index.json`);
  validateEnvelope(index, id, revision);
  if (!Array.isArray(index.payload)) fail('Invalid import source index payload.');
  const paths = new Set<string>(), digests = new Set<string>(), ids = new Set<string>(), payloads: unknown[] = [];
  for (const entry of index.payload) {
    if (!isObject(entry) || typeof entry.importId !== 'string' || !/^i-[0-9]{8,}$/.test(entry.importId) || /^i-0+$/.test(entry.importId) || entry.path !== `${root}/imports/${entry.importId}.json` || !hash(entry.sourceDigest) || paths.has(entry.path) || ids.has(entry.importId) || digests.has(entry.sourceDigest) || !descriptors.has(entry.path)) fail('Invalid, missing or duplicate import source index entry.');
    paths.add(entry.path); ids.add(entry.importId); digests.add(entry.sourceDigest);
    if (descriptors.get(entry.path)!.bytes > PAYLOAD_LIMIT) fail('Embedded import source exceeds the 16 MiB payload limit.');
    const source = await load<SourceEnvelope>(entry.path);
    validateEnvelope(source, id, revision);
    if (source.importId !== entry.importId || source.sourceDigest !== entry.sourceDigest) fail('Import source ownership, id or digest disagrees with its index.');
    payloads.push(source.payload);
    if (await sha256(encodeCanonical(source.payload)) !== entry.sourceDigest) fail('Import source canonical content digest mismatch.');
  }
  await decodeImportSources(payloads);
  if ([...descriptors.keys()].filter(path => path.startsWith(`${root}/imports/`) && path !== `${root}/imports/index.json`).some(path => !paths.has(path))) fail('Import source index omits a source file.');
};
const validateRun = async (id: string, revision: string, load: <T>(path: string) => Promise<T>, descriptors: ReadonlyMap<string, FileDescriptor>, options: CanonicalTreeOptions): Promise<void> => {
  const root = accountPath(id), index = await load<RunIndex>(`${root}/run/index.json`);
  validateIndex(index, id, { allowDuplicateIds: options.import });
  if (!isVersion(index.sourceRevision) || BigInt(index.sourceRevision) > BigInt(revision)) fail('Invalid run index source revision.');
  const ordinals = new Set<number>(), hitIds = new Map<string, string>(), paths = new Set<string>();
  const seenIds = new Set<string>(), repeatedIds = new Set<string>();
  for (const hitId of index.hitIds) { if (seenIds.has(hitId)) repeatedIds.add(hitId); seenIds.add(hitId); }
  const orderedIds: string[] = [], frequencies = new Map<number, TimestampFrequency>();
  let recent: HitReference[] = [], firstAt: number | null = null, minAt: number | null = null, maxAt: number | null = null;
  const partitions = new Map<string, number[]>();
  for (const descriptor of index.chunks) {
    const file = descriptors.get(descriptor.path);
    if (!file || paths.has(descriptor.path) || chunkPath(id, descriptor.partition, descriptor.sequence) !== descriptor.path || Object.keys(file).some(key => !same(file[key as keyof FileDescriptor], descriptor[key as keyof typeof descriptor]))) fail('Index and manifest chunk descriptors disagree.');
    paths.add(descriptor.path);
    const sequences = partitions.get(descriptor.partition) ?? [];
    sequences.push(descriptor.sequence); partitions.set(descriptor.partition, sequences);
    const chunk = await load<Chunk>(descriptor.path);
    validateEnvelope(chunk, id, revision);
    validateChunk(chunk, descriptor, id);
    for (const { ordinal, hit } of chunk.entries) {
      const content = repeatedIds.has(hit.id) ? await sha256(encodeCanonical(hit)) : '', previous = hitIds.get(hit.id);
      if (ordinals.has(ordinal) || ordinal >= index.total || (previous !== undefined && (!options.import || previous !== content))) fail('Duplicate/conflicting hit identity or cross-chunk ordinal.');
      ordinals.add(ordinal); hitIds.set(hit.id, content); orderedIds[ordinal] = hit.id;
      if (ordinal === 0) firstAt = hit.at;
      minAt = Math.min(minAt ?? hit.at, hit.at); maxAt = Math.max(maxAt ?? hit.at, hit.at);
      const frequency = frequencies.get(hit.at);
      if (frequency) { frequency.count++; frequency.firstOrdinal = Math.min(frequency.firstOrdinal, ordinal); }
      else frequencies.set(hit.at, { at: hit.at, count: 1, firstOrdinal: ordinal });
      recent = [...recent, { path: descriptor.path, ordinal, at: hit.at }].sort(recentOrder).slice(0, 50);
    }
  }
  for (const sequences of partitions.values()) if (sequences.sort((a, b) => a - b).some((sequence, offset) => sequence !== offset + 1)) fail('Chunk partition sequences must begin at one without gaps.');
  if ([...descriptors.keys()].filter(path => path.startsWith(`${root}/run/`) && path !== `${root}/run/index.json`).length !== paths.size || ordinals.size !== index.total || !same(index.hitIds, orderedIds) || index.nextOrdinal !== ordinals.size || index.firstAt !== firstAt || index.minAt !== minAt || index.maxAt !== maxAt || !same(index.timestamps, [...frequencies.values()].sort((a, b) => a.at - b.at)) || !same(index.recent, recent)) fail('Run index is not the exact authoritative chunk projection.');
};

/** Map boundary additionally enforces exact membership; no omitted or unregistered payloads. */
export const validateCanonicalTree = async (manifest: Manifest, files: ReadonlyMap<string, Uint8Array>, options: CanonicalTreeOptions = {}): Promise<void> => {
  validateManifest(manifest);
  const listed = new Set(manifest.files.map(file => file.path));
  if (files.size !== listed.size + 1 || !files.has('manifest.json') || [...files.keys()].some(path => path !== 'manifest.json' && !listed.has(path))) fail('Manifest and file map membership disagree.');
  await validateCanonicalFiles(manifest, async path => files.get(path) ?? fail(`Missing required canonical file: ${path}`), options);
};

/** Full transfer/recovery audit, retaining one decoded chunk rather than full histories. */
export const validateCanonicalFiles = async (manifest: Manifest, read: CanonicalFileReader, options: CanonicalTreeOptions = {}): Promise<void> => {
  validateManifest(manifest);
  const descriptors = new Map<string, FileDescriptor>();
  let total = 0;
  for (const file of manifest.files) {
    validateDescriptor(file, manifest.revision);
    if (descriptors.has(file.path)) fail('Duplicate manifest path.');
    descriptors.set(file.path, file); total += file.bytes;
    if (options.import && file.bytes > PAYLOAD_LIMIT) fail('Canonical archive payload exceeds 16 MiB.');
  }
  const manifestBytes = await read('manifest.json');
  if (!ArrayBuffer.isView(manifestBytes) || Object.prototype.toString.call(manifestBytes) !== '[object Uint8Array]') fail('Missing manifest bytes.');
  if (options.import && (descriptors.size + 1 > 10000 || manifestBytes.byteLength > 4 * 1024 * 1024 || total + manifestBytes.byteLength > 256 * 1024 * 1024)) fail('Canonical archive exceeds the supported entry, manifest or uncompressed limit.');
  // Verify all exact bytes before semantic decoding, including nonselected accounts.
  for (const [path, file] of descriptors) {
    const bytes = await read(path);
    if (!ArrayBuffer.isView(bytes) || Object.prototype.toString.call(bytes) !== '[object Uint8Array]' || bytes.byteLength !== file.bytes || await sha256(bytes) !== file.sha256) fail(`File byte length or SHA-256 mismatch: ${path}`);
  }
  if (!same(decodeCanonical(manifestBytes), manifest)) fail('Supplied manifest and exact manifest file disagree.');
  const load = async <T>(path: string): Promise<T> => {
    const file = descriptors.get(path);
    if (!file) return fail(`Missing required canonical file: ${path}`);
    const bytes = await read(path);
    // A lazy source cannot substitute different bytes between the integrity and semantic passes.
    if (!ArrayBuffer.isView(bytes) || Object.prototype.toString.call(bytes) !== '[object Uint8Array]' || bytes.byteLength !== file.bytes || await sha256(bytes) !== file.sha256) fail(`File changed during canonical validation: ${path}`);
    return decodeCanonical(bytes) as T;
  };
  // Check supported unknown JSON in every metadata payload, not just selected known fields.
  for (const path of descriptors.keys()) if (!/\/run\/y/.test(path) && !/\/imports\/i-/.test(path)) await load(path);
  const directory = await load<Directory>('shared/accounts.json');
  if (!isObject(directory) || directory.schemaVersion !== 1 || !isVersion(directory.recordVersion) || BigInt(directory.recordVersion) > BigInt(manifest.revision) || !Array.isArray(directory.accounts)) fail('Invalid account directory.');
  validatePreferences(await load('device/preferences.json'));
  await load('shared/extensions.json'); await load('shared/export-metadata.json');
  const ids = new Set<string>(), handles = new Set<string>();
  for (const entry of directory.accounts) {
    if (!isObject(entry) || typeof entry.accountId !== 'string' || !ACCOUNT_ID.test(entry.accountId) || typeof entry.handle !== 'string' || !entry.handle.trim() || !validateInstant(entry.registeredAt) || ids.has(entry.accountId) || handles.has(entry.handle)) fail('Invalid or duplicate account directory identity.');
    ids.add(entry.accountId); handles.add(entry.handle);
    const root = accountPath(entry.accountId);
    const envelope = async <T>(suffix: string): Promise<Envelope<T>> => {
      const value = await load<Envelope<T>>(`${root}/${suffix}`);
      validateEnvelope(value, entry.accountId, manifest.revision);
      if (!Object.hasOwn(value, 'payload')) fail('Canonical entity payload is missing.');
      return value;
    };
    const account = await envelope<Identity>('account.json');
    validateIdentity(account.payload);
    if (account.payload.handle !== entry.handle || account.payload.registeredAt !== entry.registeredAt) fail('Directory and account registration/handle disagree.');
    const profile = await envelope('profile.json');
    validateProfile(profile.payload);
    if (Object.hasOwn(profile, 'emailVerification')) fail('Profile verification belongs in the profile payload.');
    validateSettings((await envelope('settings.json')).payload);
    await envelope('extensions.json');
    const games = await envelope('plugins/games.json');
    if ((games as unknown as Record<string, unknown>).pluginId !== 'games') fail('Unregistered plugin envelope.');
    validateGames(games.payload);
    await validateRun(entry.accountId, manifest.revision, load, descriptors, options);
    await validateImports(root, entry.accountId, manifest.revision, load, descriptors);
  }
  if (manifest.accountId !== null && !ids.has(manifest.accountId)) fail('Manifest selected account is absent from its directory.');
  for (const path of descriptors.keys()) if (path.startsWith('accounts/') && !ids.has(path.split('/')[1])) fail('File tree contains an unlisted account.');
};
