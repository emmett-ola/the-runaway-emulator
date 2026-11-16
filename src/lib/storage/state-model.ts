import type { Hit, UserProfile, UserSettings } from './model';

export interface FileDescriptor {
  path: string;
  module: string;
  schemaVersion: number;
  fileVersion: string;
  bytes: number;
  sha256: string;
}
export interface ChunkDescriptor extends FileDescriptor {
  partition: string;
  sequence: number;
  minAt: number;
  maxAt: number;
  count: number;
  firstOrdinal: number;
  lastOrdinal: number;
}
export interface TimestampFrequency { at: number; count: number; firstOrdinal: number }
export interface HitReference { path: string; ordinal: number; at: number }
export interface RunIndex {
  accountId: string;
  schemaVersion: 1;
  projectionVersion: 1;
  sourceRevision: string;
  nextOrdinal: number;
  total: number;
  firstAt: number | null;
  minAt: number | null;
  maxAt: number | null;
  chunks: ChunkDescriptor[];
  /** Exact hit ids in ordinal order; derived from chunks, never independent authority. */
  hitIds: string[];
  timestamps: TimestampFrequency[];
  recent: HitReference[];
}
export interface AccountSnapshot {
  accountId: string;
  username: string;
  registeredAt: number;
  profile?: UserProfile;
  settings?: UserSettings;
  cardCollections?: Record<string, number>;
  total: number;
  index: RunIndex;
}
export interface StoreSnapshot { schemaVersion: 2; users: Readonly<Record<string, Readonly<AccountSnapshot>>> }
export interface RunView {
  accountId: string;
  revision: string;
  timezone: string;
  month: string;
  total: number;
  firstAt: number | null;
  timestamps: readonly TimestampFrequency[];
  dayCounts: Readonly<Record<string, number>>;
  recentHits: readonly Hit[];
}
export interface CommitReceipt { generation: string; revision: string; accountId?: string }
export interface Diagnostic { code: string; message: string }
export interface StorageState { status: 'booting' | 'ready' | 'blocked'; revision: string; diagnostics: readonly Diagnostic[] }
export interface DevicePreferences {
  timezone: string;
  appearance: 'light' | 'dark';
  language: string;
  calendarTheme: string;
  mode: 'local';
}
export interface ProfilePayload { email?: string; emailVerification: 'unverified'; fields: Record<string, unknown>; extensions?: unknown; presence?: unknown }
export interface Envelope<T = unknown> {
  accountId: string;
  schemaVersion: 1;
  recordVersion: string;
  createdAt: number;
  updatedAt: number;
  payload: T;
}
export interface Chunk extends Omit<Envelope, 'payload'> {
  partition: string;
  sequence: number;
  entries: { ordinal: number; hit: Hit }[];
}
export interface Manifest {
  format: 'runawaylog-files';
  formatVersion: 1;
  schemaVersion: 2;
  appVersion: string;
  deviceId: string;
  revision: string;
  exportedAt: number;
  kind: 'user' | 'recovery';
  accountId: string | null;
  auth: { algorithm: null; keyId: null; signature: null };
  files: FileDescriptor[];
}
export interface BlobRecord { id: string; bytes: Uint8Array; sha256: string; length: number; fileVersion: string }
export interface Generation {
  id: string;
  parent: string | null;
  baseRevision: string;
  revision: string;
  state: 'staged' | 'committed' | 'quarantined';
  createdAt: number;
  map: Record<string, string>;
  manifestDigest: string;
}
export interface Current { generation: string; revision: string; manifestDigest: string }
export interface Pin { id: string; generation: string; expiresAt: number }
export interface VirtualFile { path: string; bytes: Uint8Array }
export interface RecoverySnapshot { diagnostics: readonly Diagnostic[]; current: Current | null; readableGeneration: string | null; readOnly: true; files: VirtualFile[] }
