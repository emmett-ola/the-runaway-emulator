import { validateInstant } from './codec';

export interface RunHit { id: string; at: number; [key: string]: unknown }
export interface TimestampFrequency { at: number; count: number; firstOrdinal: number }
export interface HitReference { path: string; ordinal: number; at: number }
export const utcPartition = (at: number): string => {
  if (!validateInstant(at)) throw new Error('Hit timestamp is outside the valid Date range.');
  const date = new Date(at);
  const year = date.getUTCFullYear();
  return `y${year < 0 ? 'n' : ''}${String(Math.abs(year)).padStart(4, '0')}-m${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
};
export const validateHit = (hit: RunHit): void => {
  if (typeof hit.id !== 'string' || !hit.id || hit.id.includes('\0')) throw new Error('Hit requires a nonempty string id.');
  utcPartition(hit.at);
};
export const addTimestamp = (previous: readonly TimestampFrequency[], at: number, ordinal: number): TimestampFrequency[] => {
  const timestamps = previous.map(value => ({ ...value }));
  const existing = timestamps.find(value => value.at === at);
  if (existing) existing.count++;
  else timestamps.push({ at, count: 1, firstOrdinal: ordinal });
  return timestamps.sort((a, b) => a.at - b.at);
};
export const addRecent = (previous: readonly HitReference[], next: HitReference): HitReference[] =>
  [...previous, next].sort((a, b) => b.at - a.at || a.ordinal - b.ordinal).slice(0, 50);
