import { decodeCanonical, sha256 } from '../../../shared/codec';
import type { FileDescriptor, Manifest, VirtualFile } from '../storage';

export const EXPORT_LIMITS = Object.freeze({
  compressed: 64 * 1024 * 1024, entries: 10_000, payload: 16 * 1024 * 1024,
  manifest: 4 * 1024 * 1024, total: 256 * 1024 * 1024, path: 4096, depth: 64,
});
export class ExportError extends Error {
  readonly code: string;
  constructor(code: string, message: string) { super(message); this.name = 'ExportError'; this.code = code; }
}
export const refuse = (code: string, message: string): never => { throw new ExportError(code, message); };
export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const partition = 'y(?:[0-9]{4,}|n[0-9]{4,})-m(?:0[1-9]|1[0-2])';
const chunk = new RegExp(`^run/${partition}-[0-9]{6,}\\.json$`);
export const SHARED_PATHS = ['shared/accounts.json', 'shared/extensions.json', 'shared/export-metadata.json', 'device/preferences.json'] as const;

/** Validate the original name, never a normalized or sanitized approximation. */
export const validateExportPath = (path: string, recovery = false): void => {
  if (typeof path !== 'string' || path.length > EXPORT_LIMITS.path) refuse('path-limit', 'Export path exceeds 4096 ASCII bytes.');
  if (!/^[\x21-\x7e]+$/.test(path) || /[\\%:]/.test(path) || path.split('/').some(part => !part || part === '.' || part === '..')) {
    refuse('path', 'Export contains an unsafe logical path.');
  }
  if (path === 'manifest.json' || SHARED_PATHS.some(allowed => allowed === path)) return;
  if (recovery && path.startsWith('recovery/') && path.endsWith('.bin') && UUID.test(path.slice(9, -4))) return;
  const [root, id, ...parts] = path.split('/');
  const rest = parts.join('/');
  if (root === 'accounts' && UUID.test(id) && (
    /^(account|profile|settings|extensions)\.json$/.test(rest) || rest === 'plugins/games.json' ||
    rest === 'run/index.json' || rest === 'imports/index.json' ||
    (chunk.test(rest) && !/-0+\.json$/.test(rest)) ||
    (/^imports\/i-[0-9]{8,}\.json$/.test(rest) && !/i-0+\.json$/.test(rest))
  )) return;
  refuse('path', `Export contains an unregistered logical path: ${path}`);
};

/** Scan depth before invoking the recursive canonical codec. Quoted brackets do not count. */
export const decodeExportJson = (bytes: Uint8Array): unknown => {
  let depth = 0, quoted = false, escaped = false;
  for (const byte of bytes) {
    if (quoted) {
      if (escaped) escaped = false;
      else if (byte === 92) escaped = true;
      else if (byte === 34) quoted = false;
    } else if (byte === 34) quoted = true;
    else if (byte === 123 || byte === 91) {
      if (++depth > EXPORT_LIMITS.depth) refuse('depth-limit', 'Export JSON exceeds 64 nesting levels.');
    } else if (byte === 125 || byte === 93) --depth;
  }
  try { return decodeCanonical(bytes); }
  catch { return refuse('json', 'Export contains invalid run-json-1 data.'); }
};
export const object = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
export const moduleFor = (path: string): string => path.startsWith('recovery/') ? 'recovery' :
  path.includes('/run/') ? 'run' : path.includes('/plugins/') ? 'games' : path.split('/').at(-1)!.replace('.json', '');

export const validateDescriptor = (file: FileDescriptor, recovery = false): void => {
  validateExportPath(file.path, recovery);
  if (file.path === 'manifest.json' || file.schemaVersion !== 1 || file.module !== moduleFor(file.path) ||
    !/^[1-9][0-9]*$/.test(file.fileVersion) || !/^[0-9a-f]{64}$/.test(file.sha256) ||
    !Number.isSafeInteger(file.bytes) || file.bytes < 0) refuse('descriptor', 'Export contains an invalid file descriptor.');
};
export const verifyExportFile = async (file: VirtualFile, descriptor: FileDescriptor): Promise<unknown> => {
  if (file.path !== descriptor.path || file.bytes.byteLength !== descriptor.bytes || await sha256(file.bytes) !== descriptor.sha256) {
    refuse('integrity', `Committed export bytes do not match their descriptor: ${descriptor.path}`);
  }
  return file.path.startsWith('recovery/') ? undefined : decodeExportJson(file.bytes);
};

export const validateManifest = (value: unknown): Manifest => {
  if (!object(value)) return refuse('manifest', 'Unsupported committed export manifest.');
  const { format, formatVersion, schemaVersion, appVersion, deviceId, revision, exportedAt, kind, accountId, auth, files } = value;
  if (format !== 'runawaylog-files' || formatVersion !== 1 || schemaVersion !== 2 ||
    typeof appVersion !== 'string' || typeof deviceId !== 'string' || typeof revision !== 'string' ||
    !/^(0|[1-9][0-9]*)$/.test(revision) || typeof exportedAt !== 'number' || !Number.isSafeInteger(exportedAt) ||
    (kind !== 'user' && kind !== 'recovery') ||
    !(accountId === null || (typeof accountId === 'string' && UUID.test(accountId))) ||
    !object(auth) || auth.algorithm !== null || auth.keyId !== null || auth.signature !== null ||
    !Array.isArray(files)) return refuse('manifest', 'Unsupported committed export manifest.');
  const seen = new Set<string>();
  const descriptors: FileDescriptor[] = [];
  for (const item of files) {
    if (!object(item)) return refuse('descriptor', 'Export contains an invalid file descriptor.');
    const { path, module, schemaVersion: fileSchema, fileVersion, bytes, sha256: digest } = item;
    if (typeof path !== 'string' || typeof module !== 'string' || typeof fileSchema !== 'number' ||
      typeof fileVersion !== 'string' || typeof bytes !== 'number' || typeof digest !== 'string') {
      return refuse('descriptor', 'Export contains an invalid file descriptor.');
    }
    const descriptor: FileDescriptor = { path, module, schemaVersion: fileSchema, fileVersion, bytes, sha256: digest };
    validateDescriptor(descriptor, kind === 'recovery');
    if (seen.has(path)) refuse('membership', 'Export manifest contains duplicate paths.');
    seen.add(path);
    descriptors.push(descriptor);
  }
  return { format, formatVersion, schemaVersion, appVersion, deviceId, revision, exportedAt, kind, accountId,
    auth: { algorithm: null, keyId: null, signature: null }, files: descriptors };
};

/** Output envelope only: selecting one account may shrink a larger installation. */
export const preflightExport = (files: readonly FileDescriptor[], manifestBytes: number, recovery = false): void => {
  if (manifestBytes < 0 || !Number.isSafeInteger(manifestBytes)) refuse('manifest-limit', 'Export manifest byte length is invalid.');
  if (files.length + 1 > EXPORT_LIMITS.entries) refuse('entry-limit', 'Export exceeds 10000 ZIP entries including manifest.');
  if (manifestBytes > EXPORT_LIMITS.manifest) refuse('manifest-limit', 'Export manifest exceeds 4 MiB.');
  let total = manifestBytes;
  const seen = new Set<string>();
  for (const file of files) {
    validateDescriptor(file, recovery);
    if (seen.has(file.path)) refuse('membership', 'Export contains duplicate paths.');
    seen.add(file.path);
    if (file.bytes > EXPORT_LIMITS.payload) refuse('payload-limit', `Export payload exceeds 16 MiB: ${file.path}`);
    total += file.bytes;
    if (total > EXPORT_LIMITS.total) refuse('total-limit', 'Export exceeds 256 MiB uncompressed including manifest.');
  }
};
