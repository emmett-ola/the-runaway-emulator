import { Zip, ZipDeflate, ZipPassThrough } from 'fflate';
import { encodeCanonical, sha256 } from '../../../shared/codec';
import { version as APP_VERSION } from '../version';
import type { FileDescriptor, Manifest, RecoverySnapshot, VirtualFile } from '../storage';
import {
  EXPORT_LIMITS, SHARED_PATHS, UUID, ExportError, decodeExportJson, moduleFor, object,
  preflightExport, refuse, validateManifest, verifyExportFile,
} from './validation';

export interface ArchiveSource {
  manifest: Uint8Array;
  manifestDigest: string;
  revision: string;
  paths: readonly string[];
  files(paths: readonly string[]): AsyncIterable<VirtualFile>;
}
type DirectoryEntry = { accountId: string; handle: string; registeredAt: number };
const descriptor = async (path: string, bytes: Uint8Array, fileVersion: string): Promise<FileDescriptor> => ({
  path, module: moduleFor(path), schemaVersion: 1, fileVersion, bytes: bytes.byteLength, sha256: await sha256(bytes),
});
const manifestFor = (deviceId: string, revision: string, kind: Manifest['kind'], accountId: string | null, files: FileDescriptor[], exportedAt: number): Manifest => ({
  format: 'runawaylog-files', formatVersion: 1, schemaVersion: 2, appVersion: APP_VERSION, deviceId, revision, exportedAt,
  kind, accountId, auth: { algorithm: null, keyId: null, signature: null }, files,
});
const oneFile = async (source: ArchiveSource, path: string): Promise<VirtualFile> => {
  let result: VirtualFile | undefined;
  for await (const file of source.files([path])) {
    if (file.path !== path || result) refuse('membership', 'Pinned export returned duplicate or unexpected files.');
    result = file;
  }
  return result ?? refuse('missing-file', `Pinned export file is missing: ${path}`);
};

/** Stage compressed bytes, never a whole uncompressed account history. No download occurs here. */
const stageZip = async (manifest: Manifest, files: () => AsyncIterable<VirtualFile>): Promise<Uint8Array> => {
  const manifestBytes = encodeCanonical(manifest);
  decodeExportJson(manifestBytes);
  preflightExport(manifest.files, manifestBytes.byteLength, manifest.kind === 'recovery');
  const chunks: Uint8Array[] = [];
  let length = 0, completed = false, failure: Error | undefined;
  const zip = new Zip((error, bytes, final) => {
    if (failure) return;
    if (error) { failure = error; return; }
    length += bytes.byteLength;
    if (length > EXPORT_LIMITS.compressed) {
      failure = new ExportError('compressed-limit', 'Export exceeds 64 MiB compressed; no archive was downloaded.');
      return;
    }
    chunks.push(bytes);
    completed = final;
  });
  const push = (file: VirtualFile): void => {
    const stream = file.path.startsWith('recovery/') ? new ZipPassThrough(file.path) : new ZipDeflate(file.path, { level: 6 });
    stream.mtime = new Date(1980, 0, 1, 0, 0, 0);
    stream.os = 3;
    stream.attrs = 0o100644 * 65536;
    zip.add(stream);
    for (let offset = 0; offset < file.bytes.byteLength; offset += 65536) {
      stream.push(file.bytes.subarray(offset, offset + 65536), offset + 65536 >= file.bytes.byteLength);
      if (failure) throw failure;
    }
    if (!file.bytes.byteLength) stream.push(file.bytes, true);
    if (failure) throw failure;
  };
  try {
    push({ path: 'manifest.json', bytes: manifestBytes });
    let index = 0;
    for await (const file of files()) {
      const expected = manifest.files[index++];
      if (!expected || file.path !== expected.path) refuse('membership', 'ZIP payload ordering or membership changed.');
      await verifyExportFile(file, expected);
      push(file);
    }
    if (index !== manifest.files.length) refuse('missing-file', 'ZIP export is missing a payload.');
    zip.end();
    if (failure) throw failure;
    if (!completed) refuse('zip', 'ZIP encoding did not finish.');
    const output = new Uint8Array(length);
    let offset = 0;
    for (const bytes of chunks) { output.set(bytes, offset); offset += bytes.byteLength; }
    return output;
  } finally { zip.terminate(); }
};

/** Authoritative pinned projection. UI records contribute only the requested handle. */
export const createExportArchive = async (source: ArchiveSource, username: string, exportedAt = Date.now()): Promise<Uint8Array> => {
  if (await sha256(source.manifest) !== source.manifestDigest) refuse('integrity', 'Committed manifest digest mismatch.');
  const committed = validateManifest(decodeExportJson(source.manifest));
  if (committed.kind !== 'user' || committed.revision !== source.revision) refuse('manifest', 'Export requires the current committed user generation.');
  const byPath = new Map(committed.files.map(file => [file.path, file]));
  const membership = ['manifest.json', ...byPath.keys()].sort();
  if (JSON.stringify([...source.paths].sort()) !== JSON.stringify(membership)) refuse('membership', 'Committed manifest and pinned generation membership disagree.');
  const directoryDescriptor = byPath.get('shared/accounts.json') ?? refuse('missing-file', 'Committed account directory is missing.');
  const directory = await verifyExportFile(await oneFile(source, directoryDescriptor.path), directoryDescriptor);
  if (!object(directory) || directory.schemaVersion !== 1 || typeof directory.recordVersion !== 'string' || !Array.isArray(directory.accounts)) {
    return refuse('directory', 'Committed account directory is invalid.');
  }
  const matches = directory.accounts.filter(entry => object(entry) && entry.handle === username);
  if (matches.length !== 1) refuse('account', 'Requested account is missing or ambiguous in the committed generation.');
  const entry: unknown = matches[0];
  if (!object(entry) || typeof entry.accountId !== 'string' || !UUID.test(entry.accountId) ||
    typeof entry.registeredAt !== 'number' || !Number.isSafeInteger(entry.registeredAt)) {
    return refuse('account', 'Committed account identity is invalid.');
  }
  const selected: DirectoryEntry = { accountId: entry.accountId, handle: username, registeredAt: entry.registeredAt };
  const root = `accounts/${selected.accountId}/`;
  const paths = [...byPath.keys()].filter(path => path.startsWith(root) || SHARED_PATHS.some(allowed => allowed === path)).sort();
  const required = ['account.json', 'profile.json', 'settings.json', 'extensions.json', 'plugins/games.json', 'run/index.json', 'imports/index.json'];
  if (required.some(path => !byPath.has(root + path))) refuse('missing-file', 'Committed account is missing a required file.');
  const rewritten = encodeCanonical({ schemaVersion: 1, recordVersion: directory.recordVersion, accounts: [selected] });
  const directoryOutput = await descriptor(directoryDescriptor.path, rewritten, directoryDescriptor.fileVersion);
  const descriptors = paths.map(path => path === directoryOutput.path ? directoryOutput : byPath.get(path)!);
  preflightExport(descriptors, 0);
  // First pass verifies each original committed file, including the rewritten directory's source.
  const seen = new Set<string>();
  for await (const file of source.files(paths)) {
    if (!paths.includes(file.path) || seen.has(file.path)) refuse('membership', 'Pinned export returned duplicate or unexpected files.');
    seen.add(file.path);
    const value = await verifyExportFile(file, byPath.get(file.path)!);
    if (file.path.startsWith(root) && (!object(value) || value.accountId !== selected.accountId)) refuse('account', 'Account envelope and path disagree.');
    if (file.path === root + 'account.json' && (!object(value) || !object(value.payload) || value.payload.handle !== selected.handle || value.payload.registeredAt !== selected.registeredAt)) {
      refuse('account', 'Account identity and directory disagree.');
    }
  }
  if (seen.size !== paths.length) refuse('missing-file', 'Pinned export is missing a selected payload.');
  const manifest = manifestFor(committed.deviceId, committed.revision, 'user', selected.accountId, descriptors, exportedAt);
  return stageZip(manifest, async function* () {
    for (const path of paths) {
      if (path === directoryOutput.path) yield { path, bytes: rewritten };
      else yield await oneFile(source, path);
    }
  });
};

/** Raw rescue is explicitly non-importable, retains damaged bytes, and never bypasses format limits. */
export const createRecoveryArchive = async (snapshot: RecoverySnapshot, exportedAt = Date.now()): Promise<Uint8Array> => {
  if (!snapshot.files.length) refuse('recovery-unavailable', 'Recovery cannot access any original bytes; no archive was downloaded.');
  try {
    if (snapshot.files.length + 2 > EXPORT_LIMITS.entries) refuse('entry-limit', 'Raw recovery exceeds 10000 ZIP entries including metadata and manifest.');
    const registered = new Map<string, Uint8Array>();
    const mapping: { originalPath: string; recoveryPath: string }[] = [];
    let total = 0;
    for (const file of snapshot.files) {
      if (file.bytes.byteLength > EXPORT_LIMITS.payload) refuse('payload-limit', 'Raw recovery payload exceeds 16 MiB.');
      total += file.bytes.byteLength;
      if (total > EXPORT_LIMITS.total) refuse('total-limit', 'Raw recovery exceeds 256 MiB uncompressed.');
      const path = `recovery/${crypto.randomUUID()}.bin`;
      if (registered.has(path)) refuse('collision', 'Recovery evidence path UUID collision.');
      registered.set(path, file.bytes);
      mapping.push({ originalPath: file.path, recoveryPath: path });
    }
    const metadataPath = 'shared/export-metadata.json';
    const metadata = encodeCanonical({ warning: 'Raw damaged-byte rescue; may contain multiple accounts. Not an ordinary account import.',
      readOnly: true, diagnostics: snapshot.diagnostics, current: snapshot.current, readableGeneration: snapshot.readableGeneration, files: mapping });
    decodeExportJson(metadata);
    registered.set(metadataPath, metadata);
    const paths = [...registered.keys()].sort();
    const descriptors: FileDescriptor[] = [];
    for (const path of paths) descriptors.push(await descriptor(path, registered.get(path)!, '1'));
    const manifest = manifestFor('unavailable', snapshot.current?.revision ?? '0', 'recovery', null, descriptors, exportedAt);
    return await stageZip(manifest, async function* () { for (const path of paths) yield { path, bytes: registered.get(path)! }; });
  } catch (error) {
    if (error instanceof ExportError) throw new ExportError(error.code, `Raw recovery export refused: ${error.message} Original evidence was not changed.`);
    throw error;
  }
};
