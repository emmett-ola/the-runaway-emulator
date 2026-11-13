import type { Hit, Store, UserRecord } from './model';

export type StorageDiagnostic = {
  code: 'invalid-input' | 'dropped-hit' | 'registration-conflict' | 'write-blocked';
  message: string;
  username?: string;
  hitIndex?: number;
};
export type MigrationResult = { store: Store; diagnostics: StorageDiagnostic[]; blocked: boolean };

export class MigrationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MigrationError';
  }
}

const object = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);
const instant = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value) && Number.isFinite(new Date(value).getTime());
const own = (value: object, key: string): boolean => Object.hasOwn(value, key);
const empty = (): Store => ({ schemaVersion: 2, users: {} });

const localMidnight = (value: unknown): number | undefined => {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(0);
  date.setFullYear(year, month - 1, day);
  date.setHours(0, 0, 0, 0);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return;
  return date.getTime();
};

const stableId = (username: string, index: number, hit: unknown): string => {
  const text = JSON.stringify([username, index, hit]);
  let hash = 2166136261;
  for (let i = 0; i < text.length; i++) hash = Math.imul(hash ^ text.charCodeAt(i), 16777619);
  return `migrated-${(hash >>> 0).toString(16)}-${index}`;
};

const validRecord = (value: unknown, username: string): value is UserRecord => {
  if (!object(value) || value.username !== username || !instant(value.registeredAt) || !Array.isArray(value.hits)) return false;
  if (value.profile !== undefined && (!object(value.profile) || own(value.profile, 'registrationDate'))) return false;
  return value.hits.every(hit => object(hit) && typeof hit.id === 'string' && !!hit.id && instant(hit.at) && !own(hit, 'timestamp') && !own(hit, 'date'));
};

const convertRecord = (value: unknown, username: string, now: number, diagnostics: StorageDiagnostic[]): UserRecord => {
  if (!object(value) || typeof value.username !== 'string' || !value.username || value.username !== username || !Array.isArray(value.hits)) {
    throw new MigrationError(`Cannot classify user record: ${username}`);
  }
  if (value.profile !== undefined && !object(value.profile)) throw new MigrationError(`Cannot classify profile: ${username}`);
  const usedIds = new Set(value.hits.flatMap(hit => object(hit) && typeof hit.id === 'string' && hit.id ? [hit.id] : []));
  const hits: Hit[] = [];
  value.hits.forEach((rawHit, hitIndex) => {
    const at = object(rawHit)
      ? instant(rawHit.at) ? rawHit.at : instant(rawHit.timestamp) ? rawHit.timestamp : localMidnight(rawHit.date)
      : undefined;
    if (at === undefined) {
      diagnostics.push({ code: 'dropped-hit', message: 'Unresolvable hit retained in the full original backup, not active history.', username, hitIndex });
      return;
    }
    const source = rawHit as Record<string, unknown>;
    let id = typeof source.id === 'string' && source.id ? source.id : stableId(username, hitIndex, source);
    if (source.id !== id) {
      while (usedIds.has(id)) id += '-generated';
      usedIds.add(id);
    }
    const hit: Hit = { ...source, id, at };
    delete hit.timestamp;
    delete hit.date;
    hits.push(hit);
  });
  const earliest = hits.reduce((first, hit) => Math.min(first, hit.at), Infinity);
  const derived = earliest === Infinity ? now : earliest;
  const profile = object(value.profile) ? { ...value.profile } : undefined;
  const known = instant(value.registeredAt) ? value.registeredAt : instant(profile?.registrationDate) ? profile.registrationDate : undefined;
  if (known !== undefined && hits.length && known !== earliest) {
    diagnostics.push({ code: 'registration-conflict', message: `Preserved known registration ${known}; earliest hit is ${earliest}.`, username });
  }
  if (profile) delete profile.registrationDate;
  return { ...value, username, registeredAt: known ?? derived, hits, ...(profile ? { profile } : {}) } as UserRecord;
};

/** Pure input conversion; original bytes are retained whenever the schema changes. */
export const migrateWithDiagnostics = (raw: unknown, now: number): MigrationResult => {
  const diagnostics: StorageDiagnostic[] = [];
  const backup = raw;
  try {
    const input: unknown = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (!object(input)) throw new MigrationError('Expected a user record, legacy map, or v2 store.');
    if (input.schemaVersion === 2 && object(input.users) && Object.entries(input.users).every(([name, record]) => validRecord(record, name)) &&
      (input.unknown === undefined || object(input.unknown)) && Object.keys(input).every(key => ['schemaVersion', 'users', 'unknown', 'metadata'].includes(key))) {
      return { store: input as Store, diagnostics, blocked: false };
    }
    let records: Record<string, unknown>;
    let unknown: Record<string, unknown> = {};
    if (own(input, 'schemaVersion')) {
      if (input.schemaVersion !== 2 || !object(input.users)) throw new MigrationError('Unsupported store schema.');
      records = input.users;
      if (input.unknown !== undefined && !object(input.unknown)) throw new MigrationError('Invalid unknown-data container.');
      unknown = { ...input.unknown as Record<string, unknown> };
      const extras = Object.fromEntries(Object.entries(input).filter(([key]) => !['schemaVersion', 'users', 'unknown', 'metadata'].includes(key)));
      if (Object.keys(extras).length) unknown.storeFields = extras;
    } else if (typeof input.username === 'string' && Array.isArray(input.hits)) {
      records = { [input.username]: input };
    } else {
      records = input;
    }
    const users: Record<string, UserRecord> = Object.create(null);
    for (const [name, record] of Object.entries(records)) {
      users[name] = convertRecord(record, name, now, diagnostics);
    }
    if (!own(unknown, 'backup')) unknown.backup = backup;
    else unknown.migrationBackups = [...(Array.isArray(unknown.migrationBackups) ? unknown.migrationBackups : []), backup];
    if (diagnostics.length) unknown.migrationDiagnostics = diagnostics;
    return { store: { schemaVersion: 2, users, unknown }, diagnostics, blocked: false };
  } catch (error) {
    diagnostics.push({ code: 'invalid-input', message: error instanceof Error ? error.message : 'Unclassifiable storage input.' });
    return { store: { ...empty(), unknown: { backup } }, diagnostics, blocked: true };
  }
};

export const migrate = (raw: unknown, now: number): Store => migrateWithDiagnostics(raw, now).store;
