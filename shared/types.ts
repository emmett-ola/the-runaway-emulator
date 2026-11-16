/** Independent run-json-1 values; never depend on an adapter or storage model. */
export type JsonPrimitive = null | boolean | number | string;
export type JsonValue = JsonPrimitive | JsonObject | JsonArray;
export interface JsonObject { readonly [key: string]: JsonValue }
export type JsonArray = readonly JsonValue[];

export const RUN_JSON_CODEC = 'run-json-1';
/** Container nesting: the root object/array is level 1; scalars add no level. */
export const MAX_JSON_DEPTH = 64;
export const MAX_INSTANT = 8_640_000_000_000_000;

/** Authority-scoped positive decimal strings; validation belongs to envelopes. */
export type RecordVersion = string;
export type AccountRevision = string;
export type FileVersion = string;
/** Integer epoch milliseconds within the inclusive ECMAScript Date range. */
export type Instant = number;

export interface RecordIdentity {
  readonly schemaVersion: number;
  readonly recordVersion: RecordVersion;
}

export interface RecordTimes {
  readonly createdAt: Instant;
  readonly updatedAt: Instant;
}

/** Reserved signature seam, not evidence of active authentication or signing. */
export interface ManifestAuth extends JsonObject {
  readonly algorithm: null;
  readonly keyId: null;
  readonly signature: null;
}

export interface ManifestDigests {
  /** SHA-256 of the complete canonical manifest, including auth. */
  readonly integrity: string;
  /** SHA-256 of the canonical manifest with only its top-level auth omitted. */
  readonly signable: string;
}

export type CodecErrorCode =
  | 'UNSUPPORTED_VALUE'
  | 'NON_FINITE_NUMBER'
  | 'INVALID_UNICODE'
  | 'NUL_CHARACTER'
  | 'CYCLE'
  | 'MAX_DEPTH'
  | 'INVALID_UTF8'
  | 'INVALID_JSON'
  | 'DUPLICATE_KEY'
  | 'CRYPTO_UNAVAILABLE';

/** path is a $-rooted JSON Pointer; offset, when present, counts UTF-16 units. */
export class CodecError extends Error {
  readonly code: CodecErrorCode;
  readonly path: string;
  readonly offset: number | undefined;

  constructor(code: CodecErrorCode, message: string, path = '$', offset?: number) {
    super(message);
    this.name = 'CodecError';
    this.code = code;
    this.path = path;
    this.offset = offset;
  }
}
