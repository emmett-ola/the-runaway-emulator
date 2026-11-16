import { zipSync } from 'fflate';
import { decodeCanonical, encodeCanonical, sha256 } from '../../shared/codec';
import { addRecent, addTimestamp, utcPartition } from '../../shared/run';
import type { Hit } from '../../shared/domain';
import type { Chunk, ChunkDescriptor, FileDescriptor, Manifest, RunIndex } from '../lib/storage';
import type { UserRecord } from '../lib/storage/model';
import { version } from '../lib/version';

export const ARCHIVE_ACCOUNT_ID = '11111111-1111-4111-8111-111111111111';
export const ARCHIVE_PEER_ID = '22222222-2222-4222-8222-222222222222';
export const ARCHIVE_DEVICE_ID = '99999999-9999-4999-8999-999999999999';
export type ArchiveAccount = UserRecord & { accountId?: string };
export interface ArchiveFixtureOptions {
  exportedAt?: number;
  sharedExtensions?: unknown;
  metadata?: unknown;
  preferences?: Record<string, unknown>;
  mutate?: (files: Map<string, Uint8Array>) => void;
  manifest?: Partial<Manifest>;
}

/** Explicit canonical metadata belongs to fixtures, never an import-time repair. */
export const canonicalHit = (id: string, at: number, extra: Record<string, unknown> = {}): Hit => ({
  ...extra, id, at, schemaVersion: 1, recordVersion: '1',
});
const envelope = (accountId: string, payload: unknown, at: number) => ({
  accountId, payload, schemaVersion: 1, recordVersion: '1', createdAt: at, updatedAt: at,
});
const moduleFor = (path: string) => path.includes('/run/') ? 'run' : path.includes('/plugins/') ? 'games' : path.split('/').at(-1)!.replace('.json', '');
const describeFile = async (path: string, bytes: Uint8Array): Promise<FileDescriptor> => ({
  path, module: moduleFor(path), schemaVersion: 1, fileVersion: '1', bytes: bytes.byteLength, sha256: await sha256(bytes),
});
export const archiveFile = (bytes: Uint8Array, filename = 'restore.zip'): File =>
  new File([new Uint8Array(bytes)], filename, { type: 'application/zip' });

/** Real FORMAT-1 ZIP bytes; callers may mutate payloads and then obtain matching hashes. */
export async function packArchiveFiles(files: Map<string, Uint8Array>, manifest: Manifest): Promise<Uint8Array> {
  const descriptors: FileDescriptor[] = [];
  for (const path of [...files.keys()].filter(path => path !== 'manifest.json').sort()) descriptors.push(await describeFile(path, files.get(path)!));
  files.set('manifest.json', encodeCanonical({ ...manifest, files: descriptors }));
  const ordered = ['manifest.json', ...descriptors.map(file => file.path)];
  return zipSync(Object.fromEntries(ordered.map(path => [path, [files.get(path)!, {
    level: 0, mtime: new Date(1980, 0, 1), os: 3, attrs: 0o100644 << 16,
  }]])));
}

/** Build canonical files without creating accounts or writing to the application's store. */
export async function createArchiveFixture(records: readonly ArchiveAccount[], options: ArchiveFixtureOptions = {}) {
  const files = new Map<string, Uint8Array>();
  const put = (path: string, value: unknown) => files.set(path, encodeCanonical(value));
  const accounts = records.map((record, index) => ({ ...record,
    accountId: record.accountId ?? [ARCHIVE_ACCOUNT_ID, ARCHIVE_PEER_ID][index] ?? `11111111-1111-4111-8111-${String(index + 1).padStart(12, '0')}`,
  }));
  put('shared/accounts.json', { schemaVersion: 1, recordVersion: '1', accounts: accounts.map(record => ({
    accountId: record.accountId, handle: record.username, registeredAt: record.registeredAt,
  })) });
  put('shared/extensions.json', options.sharedExtensions ?? {});
  put('shared/export-metadata.json', options.metadata ?? {});
  put('device/preferences.json', { timezone: 'UTC', appearance: 'light', language: 'en_us', calendarTheme: 'github-green', mode: 'local', ...options.preferences });
  for (const record of accounts) {
    const id = record.accountId;
    const root = `accounts/${id}`;
    const wrap = (payload: unknown) => envelope(id, payload, record.registeredAt);
    put(`${root}/account.json`, wrap({ handle: record.username, registeredAt: record.registeredAt, extensions: {} }));
    put(`${root}/profile.json`, wrap({ fields: Object.fromEntries(Object.entries(record.profile ?? {}).filter(([key]) => key !== 'email')),
      emailVerification: 'unverified', ...(record.profile?.email === undefined ? {} : { email: record.profile.email }) }));
    put(`${root}/settings.json`, wrap(Object.fromEntries(Object.entries(record.settings ?? {}).filter(([key]) => !['games', 'theme', 'timezone', 'darkMode'].includes(key)))));
    put(`${root}/plugins/games.json`, { ...wrap({ settings: record.settings?.games ?? {}, cardCollections: record.cardCollections ?? {} }), pluginId: 'games' });
    const owned = new Set(['accountId', 'username', 'registeredAt', 'hits', 'profile', 'settings', 'cardCollections', 'importBackups']);
    put(`${root}/extensions.json`, wrap(Object.fromEntries(Object.entries(record).filter(([key]) => !owned.has(key)))));
    put(`${root}/imports/index.json`, wrap([]));
    const index: RunIndex = { accountId: id, schemaVersion: 1, projectionVersion: 1, sourceRevision: '1', nextOrdinal: record.hits.length,
      total: record.hits.length, firstAt: record.hits[0]?.at ?? null, minAt: null, maxAt: null, chunks: [], hitIds: record.hits.map(hit => hit.id), timestamps: [], recent: [] };
    const partitions = new Map<string, Chunk['entries']>();
    for (const [ordinal, hit] of record.hits.entries()) {
      const partition = utcPartition(hit.at);
      const entries = partitions.get(partition) ?? [];
      entries.push({ ordinal, hit });
      partitions.set(partition, entries);
    }
    for (const [partition, entries] of partitions) {
      const path = `${root}/run/${partition}-000001.json`;
      const chunk: Chunk = { accountId: id, schemaVersion: 1, recordVersion: '1', createdAt: record.registeredAt, updatedAt: record.registeredAt, partition, sequence: 1, entries };
      put(path, chunk);
      const ats = entries.map(entry => entry.hit.at);
      const descriptor: ChunkDescriptor = { ...await describeFile(path, files.get(path)!), partition, sequence: 1,
        minAt: Math.min(...ats), maxAt: Math.max(...ats), count: entries.length, firstOrdinal: entries[0].ordinal, lastOrdinal: entries.at(-1)!.ordinal };
      index.chunks.push(descriptor);
      for (const { ordinal, hit } of entries) {
        index.minAt = Math.min(index.minAt ?? hit.at, hit.at);
        index.maxAt = Math.max(index.maxAt ?? hit.at, hit.at);
        index.timestamps = addTimestamp(index.timestamps, hit.at, ordinal);
        index.recent = addRecent(index.recent, { path, ordinal, at: hit.at });
      }
    }
    put(`${root}/run/index.json`, index);
  }
  options.mutate?.(files);
  const manifest: Manifest = { format: 'runawaylog-files', formatVersion: 1, schemaVersion: 2, appVersion: version,
    deviceId: ARCHIVE_DEVICE_ID, revision: '1', exportedAt: options.exportedAt ?? 1, kind: 'user', accountId: accounts.length === 1 ? accounts[0].accountId : null,
    auth: { algorithm: null, keyId: null, signature: null }, files: [], ...options.manifest };
  const bytes = await packArchiveFiles(files, manifest);
  return { bytes, file: archiveFile(bytes), files, manifest: decodeCanonical(files.get('manifest.json')!) as unknown as Manifest, accounts };
}
