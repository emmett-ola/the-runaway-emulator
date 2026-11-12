import type { UserData } from '../../types';

const STORAGE_KEY = 'runawaylog-data';
export type LegacyUserMap = Record<string, UserData>;

const parseWholeMap = (data = localStorage.getItem(STORAGE_KEY)): LegacyUserMap => JSON.parse(data || '{}');

export const writeWholeMap = (records: LegacyUserMap): void => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
};

export const readWholeMap = (now = Date.now()): LegacyUserMap => {
  const records = parseWholeMap();
  let changed = false;
  for (const [username, record] of Object.entries(records)) {
    if (!record || typeof record !== 'object' || !Array.isArray(record.hits)) continue;
    const repaired = ensureRegistrationDate(record, now);
    if (repaired !== record) {
      records[username] = repaired;
      changed = true;
    }
  }
  if (changed) writeWholeMap(records);
  return records;
};

export const readRecord = (username: string, now = Date.now()): UserData | null => {
  return readWholeMap(now)[username] || null;
};

export const writeRecord = (record: UserData): void => {
  const records = parseWholeMap();
  records[record.username] = record;
  writeWholeMap(records);
};

export const deleteRecord = (username: string): void => {
  const data = localStorage.getItem(STORAGE_KEY);
  if (!data) return;
  const records = parseWholeMap(data);
  delete records[username];
  writeWholeMap(records);
};

export const ensureRegistrationDate = (record: UserData, now: number): UserData => {
  if (record.profile?.registrationDate !== undefined && record.profile.registrationDate !== null) {
    return record;
  }
  let earliest = Infinity;
  for (const hit of record.hits) {
    if (Number.isFinite(hit.timestamp) && hit.timestamp < earliest) earliest = hit.timestamp;
  }
  return {
    ...record,
    profile: { ...record.profile, registrationDate: earliest === Infinity ? now : earliest },
  };
};
