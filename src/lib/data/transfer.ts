import type { HitLog, UserData, Store } from '../../types';
import { getSavedTimezone } from '../time';
import { getTheme } from '../../darkMode';
import { getCalendarTheme } from '../storage/preferences';
import { readStore, readRecord, writeRecord, readRecoveryStore } from '../storage';
import { migrateWithDiagnostics } from '../storage/migrate';
import { i18n } from '../i18n';

export type ImportedUserData = UserData & { importSource?: Store };

export const combineImportedHits = (current: HitLog[], incoming: HitLog[]): HitLog[] => {
  const ids = new Set(current.map(hit => hit.id));
  return [...current, ...incoming.filter(hit => {
    if (ids.has(hit.id)) return false;
    ids.add(hit.id);
    return true;
  })];
};

export const createExportDocument = (userData: UserData) => {
  const store = readStore();
  const record = Object.hasOwn(store.users, userData.username) ? store.users[userData.username] : userData;
  const recovery = readRecoveryStore();
  return {
    schemaVersion: 2 as const,
    users: { [userData.username]: record },
    ...(recovery.unknown ? { unknown: recovery.unknown } : {}),
    metadata: { language: i18n.getLanguage(), theme: getCalendarTheme(), appearance: getTheme(), timezone: getSavedTimezone() },
  };
};

const download = (data: unknown, filename: string): void => {
  const dataBlob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(dataBlob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

export const exportUserData = (userData: UserData): void => {
  download(createExportDocument(userData), `runawaylog-${userData.username}-${new Date().toISOString().split('T')[0]}.json`);
};

export const exportRecoveryData = (): void => {
  download(readRecoveryStore(), 'runawaylog-recovery.json');
};

/** Parsing never writes. Ambiguous files require an explicit matching username. */
export const importUserData = (file: File, username?: string): Promise<ImportedUserData> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = event => {
      try {
        const raw = JSON.parse(event.target?.result as string) as unknown;
        const records = raw && typeof raw === 'object' && !Array.isArray(raw)
          ? 'users' in raw && raw.users && typeof raw.users === 'object' ? Object.values(raw.users)
            : 'hits' in raw ? [raw] : Object.values(raw)
          : [];
        for (const record of records) {
          if (!record || typeof record !== 'object' || !('hits' in record) || !Array.isArray(record.hits)) continue;
          for (const hit of record.hits) {
            if (hit && typeof hit === 'object' && ['at', 'timestamp'].some(key => Object.hasOwn(hit, key) && (typeof hit[key] !== 'number' || !Number.isFinite(hit[key])))) {
              throw new Error('Invalid hit data format');
            }
          }
        }
        const result = migrateWithDiagnostics(event.target?.result, Date.now());
        if (result.blocked || result.diagnostics.some(d => d.code === 'dropped-hit')) throw new Error('Invalid data format; original data was not changed');
        const users = Object.values(result.store.users);
        const selected = username && Object.hasOwn(result.store.users, username) ? result.store.users[username] : users.length === 1 ? users[0] : undefined;
        if (!selected) throw new Error('Select a file with one user or a matching username');
        for (const diagnostic of result.diagnostics) console.error('[storage import]', diagnostic);
        resolve({ ...selected, importSource: result.store });
      } catch (error) {
        reject(error instanceof Error ? error : new Error('Failed to parse JSON file'));
      }
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsText(file);
  });
};

/** Only called after the dialog's merge/replace confirmation. Current identity and extensions win. */
export const applyImportedData = (current: UserData, incoming: ImportedUserData, mode: 'merge' | 'replace'): UserData => {
  const source = incoming.importSource ?? { schemaVersion: 2, users: { [incoming.username]: incoming } };
  const imports = Array.isArray(current.importBackups) ? [...current.importBackups] : current.importBackups === undefined ? [] : [current.importBackups];
  const serialized = JSON.stringify(source);
  if (!imports.some(item => JSON.stringify(item) === serialized)) imports.push(source);
  return {
    ...current,
    hits: mode === 'merge' ? combineImportedHits(current.hits, incoming.hits).sort((a, b) => a.at - b.at) : incoming.hits,
    importBackups: imports,
  };
};

/** Synchronous local transaction: never acknowledges a swallowed adapter write. */
export const confirmImportedData = (username: string, incoming: ImportedUserData, mode: 'merge' | 'replace'): UserData => {
  const current = readRecord(username);
  if (!current) throw new Error('Current user no longer exists; import was not written');
  const result = applyImportedData(current, incoming, mode);
  writeRecord(result);
  return result;
};
