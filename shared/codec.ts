import { CodecError, MAX_INSTANT, MAX_JSON_DEPTH } from './types';
import type { JsonValue, ManifestDigests } from './types';
import { compareCodePoints, pointer, validateString } from './json-values';
import { parseJson } from './json-parser';

export { CodecError, RUN_JSON_CODEC, MAX_JSON_DEPTH } from './types';
export type { JsonValue, JsonObject, JsonArray, ManifestDigests } from './types';

function unsupported(path: string, message: string): never {
  throw new CodecError('UNSUPPORTED_VALUE', message, path);
}

function plainObject(value: object): boolean {
  const prototype: unknown = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

/**
 * run-json-1: strict, lossless JSON input with code-point ordered object keys.
 * Accessors, sparse arrays and extra hidden/symbol properties are rejected,
 * rather than invoking user code or silently discarding source information.
 */
export function canonicalStringify(value: unknown): string {
  const active = new Set<object>();
  const visit = (current: unknown, path: string, depth: number): string => {
    if (current === null) return 'null';
    switch (typeof current) {
      case 'string':
        validateString(current, path);
        return JSON.stringify(current);
      case 'boolean': return current ? 'true' : 'false';
      case 'number':
        if (!Number.isFinite(current)) {
          throw new CodecError('NON_FINITE_NUMBER', 'Number is not finite IEEE-754.', path);
        }
        return JSON.stringify(Object.is(current, -0) ? 0 : current);
      case 'object': break;
      default: return unsupported(path, 'Value is not supported by run-json-1.');
    }
    const array = Array.isArray(current);
    if (!array && !plainObject(current)) unsupported(path, 'Expected a plain object.');
    if (active.has(current)) throw new CodecError('CYCLE', 'Cyclic JSON value.', path);
    if (depth >= MAX_JSON_DEPTH) {
      throw new CodecError('MAX_DEPTH', 'JSON container nesting exceeds 64.', path);
    }
    active.add(current);
    try {
      const keys = Reflect.ownKeys(current);
      const names: string[] = [];
      for (const key of keys) {
        if (typeof key !== 'string') unsupported(path, 'Symbol keys are not supported.');
        if (array && key === 'length') continue;
        validateString(key, path);
        names.push(key);
      }
      const property = (key: string): unknown => {
        const childPath = pointer(path, key);
        const descriptor = Object.getOwnPropertyDescriptor(current, key);
        if (!descriptor || !descriptor.enumerable || !('value' in descriptor)) {
          unsupported(childPath, 'Expected an enumerable data property.');
        }
        const result: unknown = descriptor.value;
        return result;
      };
      if (array) {
        // Read the own length descriptor, never inherited/custom accessors.
        const length: unknown = Object.getOwnPropertyDescriptor(current, 'length')?.value;
        if (typeof length !== 'number' || names.length !== length) {
          unsupported(path, 'Sparse arrays and array properties are not supported.');
        }
        const entries: string[] = [];
        for (let index = 0; index < length; index++) {
          entries.push(visit(property(String(index)), pointer(path, index), depth + 1));
        }
        return `[${entries.join(',')}]`;
      }
      names.sort(compareCodePoints);
      return `{${names.map(key =>
        `${JSON.stringify(key)}:${visit(property(key), pointer(path, key), depth + 1)}`,
      ).join(',')}}`;
    } finally {
      active.delete(current);
    }
  };
  return visit(value, '$', 0);
}

/** New immutable-by-ownership UTF-8 bytes; no BOM or trailing newline. */
export function encodeCanonical(value: unknown): Uint8Array {
  return new TextEncoder().encode(canonicalStringify(value));
}

/**
 * Accepts valid noncanonical JSON too; callers must verify archive raw bytes
 * before decoding. Duplicate decoded keys are rejected before any overwrite.
 */
export function decodeCanonical(input: Uint8Array | string): JsonValue {
  let source: string;
  if (typeof input === 'string') {
    source = input;
  } else {
    try {
      // Preserve a BOM as U+FEFF so it is rejected as invalid JSON, not stripped.
      source = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(input);
    } catch {
      throw new CodecError('INVALID_UTF8', 'Input is not valid UTF-8.');
    }
  }
  return parseJson(source);
}

/** Integer epoch milliseconds over the full inclusive ECMAScript Date range. */
export function validateInstant(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && Math.abs(value) <= MAX_INSTANT;
}

/**
 * Hash exact supplied bytes, including whitespace/BOM if present. This async
 * platform seam must be awaited outside IndexedDB/SQL publication transactions.
 * Missing/failing SubtleCrypto rejects; there is deliberately no fallback.
 */
export async function sha256(bytes: Uint8Array): Promise<string> {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) throw new CodecError('CRYPTO_UNAVAILABLE', 'SubtleCrypto is required for integrity.');
  // Copy the selected view only and freeze ownership before the first await.
  const snapshot = new Uint8Array(bytes);
  const digest = await subtle.digest('SHA-256', snapshot);
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
}

/**
 * Integrity includes auth; the future signable digest excludes only root auth.
 * Neither digest authenticates an operator. Envelope validation is separate.
 */
export async function manifestDigests(manifest: unknown): Promise<ManifestDigests> {
  const fullBytes = encodeCanonical(manifest);
  if (manifest === null || typeof manifest !== 'object' || Array.isArray(manifest)) {
    return unsupported('$', 'A manifest must be a plain object.');
  }
  const signable = {};
  for (const key of Object.keys(manifest)) {
    if (key === 'auth') continue;
    const descriptor = Object.getOwnPropertyDescriptor(manifest, key);
    if (!descriptor) return unsupported(pointer('$', key), 'Manifest changed during encoding.');
    Object.defineProperty(signable, key, descriptor);
  }
  const signableBytes = encodeCanonical(signable);
  const [integrity, signableDigest] = await Promise.all([sha256(fullBytes), sha256(signableBytes)]);
  return { integrity, signable: signableDigest };
}
