import { canonicalStringify, decodeCanonical, encodeCanonical, sha256 } from '../../../shared/codec';
import type { ImportSource } from './imports';
import { StorageError } from './idb';

export type { ImportSource } from './imports';
export const IMPORT_SOURCE_CODEC = 'run-json-1/base64-parts';
export const IMPORT_SOURCE_LIMITS = Object.freeze({ inline: 12 * 1024 * 1024, part: 8 * 1024 * 1024, payload: 16 * 1024 * 1024, source: 256 * 1024 * 1024 });
interface SourcePart { accountId: string; codec: typeof IMPORT_SOURCE_CODEC; sourceDigest: string; part: number; totalParts: number; data: string }
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const SOURCE_PATH = /^(?:(?:account|profile|settings|extensions)\.json|plugins\/games\.json|run\/index\.json|run\/y(?:[0-9]{4,}|n[0-9]{4,})-m(?:0[1-9]|1[0-2])-[0-9]{6,}\.json)$/;
const SHARED_PATHS = new Set(['shared/extensions.json', 'shared/export-metadata.json', 'device/preferences.json']);
const fail = (message: string): never => { throw new StorageError('import-source', message); };
const object = (value: unknown): value is Record<string, unknown> => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype: unknown = Object.getPrototypeOf(value);
  return prototype === null || prototype === Object.prototype;
};
const exactKeys = (value: Record<string, unknown>, keys: string[]) => {
  const own = Reflect.ownKeys(value);
  return own.length === keys.length && own.every(key => typeof key === 'string' && keys.includes(key) && Object.getOwnPropertyDescriptor(value, key)?.enumerable && 'value' in Object.getOwnPropertyDescriptor(value, key)!);
};

/** Provenance stays flat and opaque; its payloads are not reinterpreted as active history. */
export function validateLogicalSource(value: unknown): asserts value is ImportSource {
  if (!object(value) || !exactKeys(value, ['accountId', 'files', 'shared']) || typeof value.accountId !== 'string' || !UUID.test(value.accountId) || !object(value.files) || !object(value.shared)) return fail('Invalid flat logical import source.');
  for (const path of Object.keys(value.files)) if (path.length > 4096 || !SOURCE_PATH.test(path) || /-0+\.json$/.test(path)) fail('Unregistered relative provenance path.');
  for (const path of Object.keys(value.shared)) if (!SHARED_PATHS.has(path)) fail('Unregistered shared provenance path.');
  // Each original file owns its depth budget; provenance wrappers must not spend it.
  for (const collection of [value.files, value.shared]) {
    if (!exactKeys(collection, Object.keys(collection))) fail('Import source collections require enumerable data properties.');
    for (const payload of Object.values(collection)) canonicalBytes(payload);
  }
}
const canonicalBytes = (value: unknown): Uint8Array => {
  try { return encodeCanonical(value); }
  catch { return fail('Import source is not supported depth-64 run-json-1 data.'); }
};
const toBase64 = (bytes: Uint8Array): string => {
  const pieces: string[] = [];
  for (let offset = 0; offset < bytes.length; offset += 0x8000) pieces.push(String.fromCharCode(...bytes.subarray(offset, offset + 0x8000)));
  return btoa(pieces.join(''));
};
const fromBase64 = (data: string): Uint8Array => {
  const padding = data.endsWith('==') ? 2 : data.endsWith('=') ? 1 : 0;
  const length = data.length / 4 * 3 - padding;
  if (!data.length || data.length % 4 || data.length > Math.ceil(IMPORT_SOURCE_LIMITS.part / 3) * 4 || !/^[A-Za-z0-9+/]*={0,2}$/.test(data) || length > IMPORT_SOURCE_LIMITS.part || length < 1) fail('Invalid or oversized base64 import source part.');
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  if (padding && (alphabet.indexOf(data[data.length - padding - 1]) & (padding === 2 ? 15 : 3))) fail('Noncanonical base64 import source part.');
  let binary: string;
  try { binary = atob(data); } catch { return fail('Invalid base64 import source part.'); }
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index++) bytes[index] = binary.charCodeAt(index);
  return bytes;
};
const readPart = (value: unknown): SourcePart => {
  if (!object(value) || !exactKeys(value, ['accountId', 'codec', 'sourceDigest', 'part', 'totalParts', 'data']) || value.codec !== IMPORT_SOURCE_CODEC || typeof value.accountId !== 'string' || !UUID.test(value.accountId) || typeof value.sourceDigest !== 'string' || !/^[0-9a-f]{64}$/.test(value.sourceDigest) || typeof value.part !== 'number' || !Number.isSafeInteger(value.part) || value.part < 0 || typeof value.totalParts !== 'number' || !Number.isSafeInteger(value.totalParts) || value.totalParts < 1 || value.totalParts > IMPORT_SOURCE_LIMITS.source / IMPORT_SOURCE_LIMITS.part || value.part >= value.totalParts || typeof value.data !== 'string') return fail('Invalid import source fragment marker.');
  // Check the string cap before canonical serialization or base64 allocation.
  if (value.data.length > Math.ceil(IMPORT_SOURCE_LIMITS.part / 3) * 4 || canonicalBytes(value).byteLength > IMPORT_SOURCE_LIMITS.payload) fail('Import source fragment exceeds its payload cap.');
  return { accountId: value.accountId, codec: IMPORT_SOURCE_CODEC, sourceDigest: value.sourceDigest, part: value.part, totalParts: value.totalParts, data: value.data };
};

const WIRE_CODEC = 'run-json-1/file-strings';
/** Deterministic logical dedup key without spending original files' depth budgets. */
export const sourceKey = (source: unknown): string => {
  validateLogicalSource(source);
  return canonicalStringify({ accountId: source.accountId, codec: WIRE_CODEC,
    files: Object.fromEntries(Object.entries(source.files).map(([path, value]) => [path, canonicalStringify(value)])),
    shared: Object.fromEntries(Object.entries(source.shared).map(([path, value]) => [path, canonicalStringify(value)])),
  });
};
const wireBytes = (source: ImportSource): Uint8Array => new TextEncoder().encode(sourceKey(source));
const decodeWire = (value: unknown): ImportSource => {
  if (!object(value) || !exactKeys(value, ['accountId', 'codec', 'files', 'shared']) || value.codec !== WIRE_CODEC || !object(value.files) || !object(value.shared)) return fail('Invalid import source file-string representation.');
  const decode = (collection: Record<string, unknown>): Record<string, unknown> => Object.fromEntries(Object.entries(collection).map(([path, text]) => {
    if (typeof text !== 'string') return fail('File-string provenance contains a nonstring payload.');
    try { return [path, decodeCanonical(text)]; } catch { return fail('Original provenance file is not supported depth-64 run-json-1 data.'); }
  }));
  const source: unknown = { accountId: value.accountId, files: decode(value.files), shared: decode(value.shared) };
  validateLogicalSource(source);
  return source;
};
const fitsInlineEnvelope = (source: ImportSource): boolean => {
  try { return encodeCanonical({ accountId: source.accountId, schemaVersion: 1, recordVersion: '1', createdAt: 0, updatedAt: 0,
    importId: 'i-00000001', sourceDigest: '0'.repeat(64), payload: source }).byteLength <= IMPORT_SOURCE_LIMITS.inline + 512; }
  catch { return false; }
};

/** Keep common sources unchanged; large/deep documents become bounded transport parts. */
export async function encodeImportSource(source: ImportSource): Promise<unknown[]> {
  validateLogicalSource(source);
  if (fitsInlineEnvelope(source) && canonicalBytes(source).byteLength <= IMPORT_SOURCE_LIMITS.inline) return [source];
  const bytes = wireBytes(source);
  if (bytes.byteLength > IMPORT_SOURCE_LIMITS.source) fail('Logical import source exceeds 256 MiB.');
  const accountId = source.accountId;
  const sourceDigest = await sha256(bytes);
  const totalParts = Math.ceil(bytes.byteLength / IMPORT_SOURCE_LIMITS.part);
  return Array.from({ length: totalParts }, (_, part): SourcePart => ({ accountId, codec: IMPORT_SOURCE_CODEC, sourceDigest,
    part, totalParts, data: toBase64(bytes.subarray(part * IMPORT_SOURCE_LIMITS.part, (part + 1) * IMPORT_SOURCE_LIMITS.part)) }));
}

/** Reassemble only complete, adjacent, ordered groups; never salvage partial provenance. */
export async function decodeImportSources(payloads: readonly unknown[]): Promise<ImportSource[]> {
  const sources: ImportSource[] = [];
  const seen = new Set<string>();
  for (let index = 0; index < payloads.length; index++) {
    const value = payloads[index];
    if (!object(value) || value.codec === undefined) {
      validateLogicalSource(value);
      if (canonicalBytes(value).byteLength > IMPORT_SOURCE_LIMITS.payload) fail('Unsegmented import source exceeds 16 MiB.');
      sources.push(value);
      continue;
    }
    const first = readPart(value);
    const key = `${first.accountId}:${first.sourceDigest}`;
    if (first.part !== 0 || seen.has(key) || first.totalParts > payloads.length - index) fail('Missing, duplicated or out-of-order import source parts.');
    seen.add(key);
    const parts: Uint8Array[] = [];
    let length = 0;
    for (let part = 0; part < first.totalParts; part++) {
      const entry = readPart(payloads[index + part]);
      if (entry.part !== part || entry.totalParts !== first.totalParts || entry.accountId !== first.accountId || entry.sourceDigest !== first.sourceDigest) fail('Conflicting or noncontiguous import source parts.');
      const bytes = fromBase64(entry.data);
      length += bytes.byteLength;
      if (length > IMPORT_SOURCE_LIMITS.source) fail('Logical import source exceeds 256 MiB.');
      parts.push(bytes);
    }
    const bytes = new Uint8Array(length);
    let offset = 0;
    for (const part of parts) { bytes.set(part, offset); offset += part.byteLength; }
    if (await sha256(bytes) !== first.sourceDigest) fail('Import source digest mismatch.');
    let document: unknown;
    try { document = decodeCanonical(bytes); } catch { return fail('Reassembled import source is not supported depth-64 run-json-1 data.'); }
    const source = decodeWire(document);
    if (source.accountId !== first.accountId) fail('Import source fragment owner disagrees with its source.');
    sources.push(source);
    index += first.totalParts - 1;
  }
  return sources;
}
