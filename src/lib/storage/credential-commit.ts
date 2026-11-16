import type { CredentialRecord } from '../identity/password';
import { LocalAuthError, sameCredential, validateCredential } from '../identity/password';
import { completed, openDatabase, request, transaction } from './idb';

export interface CredentialChange {
  accountId: string;
  expected: CredentialRecord | null;
  next: CredentialRecord;
}
export const readCredential = async (accountId: string): Promise<CredentialRecord | null> => {
  const db = await openDatabase();
  const tx = transaction(db, 'readonly');
  const done = completed(tx);
  const store = tx.objectStore('credentials');
  const value: unknown = await request(store.get(accountId));
  const key = await request(store.getKey(accountId));
  await done;
  return key === undefined ? null : validateCredential(value);
};
// Runs only in the final current-pointer transaction. No crypto or arbitrary async work.
export const commitCredential = async (tx: IDBTransaction, change: CredentialChange): Promise<void> => {
  const store = tx.objectStore('credentials');
  const current: unknown = await request(store.get(change.accountId));
  const key = await request(store.getKey(change.accountId));
  if (change.expected === null ? key !== undefined : key === undefined || !sameCredential(validateCredential(current), change.expected)) {
    throw new LocalAuthError('identity_changed');
  }
  if (!change.expected || !sameCredential(change.expected, change.next)) store.put(change.next, change.accountId);
};
