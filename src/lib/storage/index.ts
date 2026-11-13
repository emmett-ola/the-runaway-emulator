import type { Store, UserRecord } from './model';
import { migrateWithDiagnostics, type MigrationResult, type StorageDiagnostic } from './migrate';
export type { Store, UserRecord, Hit, UserProfile, UserSettings, GameSettings } from './model';
export { migrate } from './migrate';

const STORAGE_KEY = 'runawaylog-data';
const BACKUP_KEY = 'runawaylog-data-backups';
let diagnostics: StorageDiagnostic[] = [];

export class StorageBlockedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'StorageBlockedError';
  }
}

export const getStorageDiagnostics = (): readonly StorageDiagnostic[] => diagnostics;

const preserveBytes = (raw: string): void => {
  const previous = localStorage.getItem(BACKUP_KEY);
  const backups: unknown = previous === null ? [] : JSON.parse(previous);
  if (!Array.isArray(backups) || backups.some(value => typeof value !== 'string')) {
    throw new StorageBlockedError('Invalid recovery archive; refusing to overwrite it.');
  }
  if (!backups.includes(raw)) {
    localStorage.setItem(BACKUP_KEY, JSON.stringify([...backups, raw]));
  }
};

export const loadStore = (now = Date.now()): MigrationResult => {
  let result: MigrationResult;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === null) {
      result = { store: { schemaVersion: 2, users: {} }, diagnostics: [], blocked: false };
    } else {
      result = migrateWithDiagnostics(raw, now);
      const serialized = JSON.stringify(result.store);
      // Malformed data is recoverable, but never authorizes creating an empty replacement.
      if (result.blocked) preserveBytes(raw);
      else if (JSON.stringify(JSON.parse(raw)) !== serialized) {
        preserveBytes(raw);
        localStorage.setItem(STORAGE_KEY, serialized);
      }
    }
    if (!result.blocked && Array.isArray(result.store.unknown?.migrationDiagnostics) && result.diagnostics.length === 0) {
      result.diagnostics = result.store.unknown.migrationDiagnostics.filter((value): value is StorageDiagnostic =>
        !!value && typeof value === 'object' && 'code' in value && 'message' in value && typeof value.message === 'string');
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Storage unavailable';
    result = { store: { schemaVersion: 2, users: {} }, diagnostics: [{ code: 'write-blocked', message }], blocked: true };
  }
  diagnostics = result.diagnostics;
  for (const diagnostic of diagnostics) console.error('[storage]', diagnostic);
  return result;
};

/** Rescue remains readable/exportable even when normal reads and writes are blocked. */
export const readRecoveryStore = (): Store => {
  const raw = localStorage.getItem(STORAGE_KEY);
  const result = raw === null ? { schemaVersion: 2 as const, users: {} } : migrateWithDiagnostics(raw, Date.now()).store;
  const archive = localStorage.getItem(BACKUP_KEY);
  const identityArchive = localStorage.getItem('runawaylog-current-user-backups');
  return { ...result, unknown: { ...result.unknown, ...(archive ? { recoveryArchive: archive } : {}), ...(identityArchive ? { identityArchive } : {}) } };
};

export const readStore = (now = Date.now()): Store => {
  const result = loadStore(now);
  if (result.blocked) throw new StorageBlockedError(result.diagnostics.map(diagnostic => diagnostic.message).join('; '));
  return result.store;
};

export const readRecord = (username: string, now = Date.now()): UserRecord | null => {
  const users = readStore(now).users;
  return Object.hasOwn(users, username) ? users[username] : null;
};

export const writeRecord = (record: UserRecord): void => {
  const store = readStore();
  if (Object.hasOwn(store.users, record.username) && store.users[record.username].registeredAt !== record.registeredAt) {
    throw new StorageBlockedError('Registration is immutable; refusing to change a known registration.');
  }
  const validated = migrateWithDiagnostics({ schemaVersion: 2, users: { [record.username]: record } }, Date.now());
  if (validated.blocked || validated.store.users[record.username] !== record) {
    throw new StorageBlockedError('Refusing to write an invalid v2 record.');
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...store, users: { ...store.users, [record.username]: record } }));
};

export const deleteRecord = (username: string): void => {
  const store = readStore();
  if (!Object.hasOwn(store.users, username)) return;
  delete store.users[username];
  localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
};
