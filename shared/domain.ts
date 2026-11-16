import type { Instant, JsonObject, JsonValue, RecordTimes, RecordVersion } from './types';

/** Canonical domain metadata, independent of local files and SQL ownership ids. */
export interface Envelope<Payload = JsonValue> extends RecordTimes {
  readonly accountId: string;
  readonly schemaVersion: 1;
  readonly recordVersion: RecordVersion;
  readonly payload: Payload;
}

export interface AccountPayload extends JsonObject {
  readonly handle: string;
  readonly registeredAt: Instant;
}

export type Account = Envelope<AccountPayload>;

/** Empty profile fields and absent email are valid; email is never a credential. */
export interface ProfilePayload {
  readonly email?: string;
  readonly emailVerification: 'unverified';
  readonly fields: JsonObject;
  readonly extensions?: JsonValue;
  readonly presence?: JsonValue;
}

export type Profile = Envelope<ProfilePayload>;

/** Payload excludes plugin settings and installation/device preferences. */
export type Settings = Envelope<JsonObject>;

export interface Plugin<Payload = JsonValue> extends Envelope<Payload> {
  readonly pluginId: string;
}

/** Newly allocated canonical hits carry positive authority-scoped versions. */
export interface Hit {
  readonly id: string;
  readonly at: Instant;
  readonly schemaVersion: 1;
  readonly recordVersion: RecordVersion;
  readonly [key: string]: unknown;
}

/** Import-boundary shape only; adapters must version it before publication. */
export interface LegacyHit {
  readonly id: string;
  readonly at: Instant;
  readonly schemaVersion?: 1;
  readonly recordVersion?: RecordVersion;
  readonly [key: string]: unknown;
}

export interface RunEntry<RunHit extends LegacyHit = Hit> {
  readonly ordinal: number;
  readonly hit: RunHit;
}

/** UTC partition and sequence are validated by the shared run selectors. */
export interface RunChunk<RunHit extends LegacyHit = Hit> extends RecordTimes {
  readonly accountId: string;
  readonly schemaVersion: 1;
  readonly recordVersion: RecordVersion;
  readonly partition: string;
  readonly sequence: number;
  readonly entries: readonly RunEntry<RunHit>[];
}

/** The source document is immutable provenance, never adopted account identity. */
export interface ImportSource<Source = JsonValue> extends Envelope<Source> {
  readonly importId: string;
}

/** Preserve scalar/null/array extension and presence values without flattening. */
export type Extensions = Envelope<JsonValue>;
