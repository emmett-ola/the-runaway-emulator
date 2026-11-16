import { canonicalStringify, validateInstant } from '../../../shared/codec';
import { ACCOUNT_ID } from './files';
import { StorageError } from './idb';
import type { Envelope } from './state-model';
import type { Directory } from './snapshot';

export const isObject = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value);
export const isVersion = (value: unknown): value is string => typeof value === 'string' && /^[1-9][0-9]*$/.test(value);
export const canonicalFailure = (message: string): never => { throw new StorageError('canonical', message); };
export function validateEnvelope(value: unknown, accountId: string, revision?: string): asserts value is Envelope {
  if (!isObject(value) || !ACCOUNT_ID.test(accountId) || value.accountId !== accountId || value.schemaVersion !== 1 || !isVersion(value.recordVersion) || (revision !== undefined && (!isVersion(revision) || BigInt(value.recordVersion) > BigInt(revision))) || !validateInstant(value.createdAt) || !validateInstant(value.updatedAt)) canonicalFailure('Invalid canonical account envelope or ownership.');
  canonicalStringify(value);
}
export function validateDirectory(value: unknown, revision: string): asserts value is Directory {
  if (!isObject(value) || value.schemaVersion !== 1 || !isVersion(value.recordVersion) || !isVersion(revision) || BigInt(value.recordVersion) > BigInt(revision) || !Array.isArray(value.accounts)) return canonicalFailure('Invalid canonical account directory.');
  const ids = new Set<string>(), handles = new Set<string>();
  for (const entry of value.accounts) {
    if (!isObject(entry) || typeof entry.accountId !== 'string' || !ACCOUNT_ID.test(entry.accountId) || typeof entry.handle !== 'string' || !entry.handle.trim() || !validateInstant(entry.registeredAt) || ids.has(entry.accountId) || handles.has(entry.handle)) canonicalFailure('Invalid or duplicate canonical directory identity.');
    ids.add(entry.accountId); handles.add(entry.handle);
  }
  canonicalStringify(value);
}
export const validateIdentity = (value: unknown): void => {
  if (!isObject(value) || typeof value.handle !== 'string' || !value.handle.trim() || !validateInstant(value.registeredAt)) canonicalFailure('Invalid canonical account identity or registration.');
};
export const validateProfile = (value: unknown): void => {
  if (!isObject(value) || value.emailVerification !== 'unverified' || !isObject(value.fields) || (Object.hasOwn(value, 'email') && typeof value.email !== 'string')) canonicalFailure('Invalid canonical profile payload.');
};
export const validateSettings = (value: unknown): void => {
  if (!isObject(value) || ['games', 'timezone', 'theme', 'darkMode', 'appearance', 'language', 'calendarTheme', 'mode'].some(key => Object.hasOwn(value, key))) canonicalFailure('Account settings contain plugin or device preferences.');
};
export const validateGames = (value: unknown): void => {
  if (!isObject(value) || !isObject(value.settings) || !isObject(value.cardCollections)) canonicalFailure('Invalid registered games plugin payload.');
};
