import { encodeCanonical, decodeCanonical, sha256 } from '../../../shared/codec';
import { version as APP_VERSION } from '../version';
import { readBlob, StorageError } from './idb';
import type { BlobRecord, FileDescriptor, Generation, Manifest } from './state-model';

export const ACCOUNT_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const partition = 'y(?:[0-9]{4,}|n[0-9]{4,})-m(?:0[1-9]|1[0-2])';
const sequence = '[0-9]{6,}';
export const accountPath = (id: string): string => {
  if (!ACCOUNT_ID.test(id)) throw new StorageError('account-id', 'Invalid canonical account UUID.');
  return `accounts/${id}`;
};
export const validatePath = (path: string): void => {
  if (path === 'manifest.json' || /^(shared\/(accounts|extensions|export-metadata)|device\/preferences)\.json$/.test(path)) return;
  const parts = path.split('/');
  if (parts[0] === 'recovery' && /^recovery\/[0-9a-f-]+\.bin$/.test(path)) return;
  if (parts[0] !== 'accounts' || !ACCOUNT_ID.test(parts[1] ?? '')) throw new StorageError('path', `Unregistered virtual path: ${path}`);
  const rest = parts.slice(2).join('/');
  if (/^(account|profile|settings|extensions)\.json$/.test(rest) || rest === 'plugins/games.json' || rest === 'run/index.json' || rest === 'imports/index.json') return;
  if (new RegExp(`^run/${partition}-${sequence}\\.json$`).test(rest) && !/-0+\.json$/.test(rest)) return;
  if (/^imports\/i-[0-9]{8,}\.json$/.test(rest)) return;
  throw new StorageError('path', `Unregistered virtual path: ${path}`);
};
export const moduleFor = (path: string): string => path.includes('/run/') ? 'run' : path.includes('/plugins/') ? 'games' : path.split('/').at(-1)!.replace('.json', '');
export const makeBlob = async (value: unknown, version: string): Promise<BlobRecord> => {
  const bytes = encodeCanonical(value);
  return { id: crypto.randomUUID(), bytes, sha256: await sha256(bytes), length: bytes.byteLength, fileVersion: version };
};
export const descriptor = (path: string, blob: BlobRecord): FileDescriptor => ({
  path, module: moduleFor(path), schemaVersion: 1, fileVersion: blob.fileVersion, bytes: blob.length, sha256: blob.sha256,
});
export const verifyBlob = async (blob: BlobRecord, expected?: FileDescriptor): Promise<void> => {
  if (blob.length !== blob.bytes.byteLength || blob.sha256 !== await sha256(blob.bytes) || !/^[a-f0-9]{64}$/.test(blob.sha256)) throw new StorageError('integrity', 'Virtual file byte length or SHA-256 mismatch.');
  if (expected && (expected.bytes !== blob.length || expected.sha256 !== blob.sha256 || expected.fileVersion !== blob.fileVersion)) throw new StorageError('descriptor', `Manifest descriptor mismatch: ${expected.path}`);
};
export const readFile = async <T>(generation: Generation, path: string): Promise<T> => {
  validatePath(path);
  const blobId = generation.map[path];
  if (!blobId) throw new StorageError('missing-file', `Virtual file is missing: ${path}`);
  const blob = await readBlob(blobId);
  await verifyBlob(blob);
  return decodeCanonical(blob.bytes) as T;
};
export const emptyManifest = (deviceId: string, revision: string): Manifest => ({
  format: 'runawaylog-files', formatVersion: 1, schemaVersion: 2, appVersion: APP_VERSION,
  deviceId, revision, exportedAt: Date.now(), kind: 'user', accountId: null,
  auth: { algorithm: null, keyId: null, signature: null }, files: [],
});
export const verifyTree = async (generation: Generation, changed?: ReadonlySet<string>): Promise<Manifest> => {
  const manifestBlob = await readBlob(generation.map['manifest.json']);
  await verifyBlob(manifestBlob);
  if (manifestBlob.sha256 !== generation.manifestDigest) throw new StorageError('manifest-digest', 'Generation manifest digest mismatch.');
  const manifest = await readFile<Manifest>(generation, 'manifest.json');
  const { validateManifest, validateDescriptor } = await import('./tree-validation');
  validateManifest(manifest);
  if (manifest.format !== 'runawaylog-files' || manifest.formatVersion !== 1 || manifest.schemaVersion !== 2 || manifest.revision !== generation.revision) throw new StorageError('manifest', 'Unsupported or inconsistent manifest.');
  const paths = Object.keys(generation.map).sort();
  const listed = ['manifest.json', ...manifest.files.map(file => file.path)].sort();
  if (new Set(listed).size !== listed.length || JSON.stringify(paths) !== JSON.stringify(listed)) throw new StorageError('membership', 'Manifest and generation membership disagree.');
  for (const file of manifest.files) {
    validateDescriptor(file, generation.revision);
    if (!changed || changed.has(file.path)) {
      const blob = await readBlob(generation.map[file.path]);
      await verifyBlob(blob, file);
      if (!file.path.startsWith('recovery/')) decodeCanonical(blob.bytes);
    }
  }
  return manifest;
};
