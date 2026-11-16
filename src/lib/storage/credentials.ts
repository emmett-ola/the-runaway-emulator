import type { CredentialRecord } from '../identity/password';
import { LocalAuthError, validateCredential } from '../identity/password';
import { createAccount, enqueue } from './commands';
import { readFile } from './files';
import type { Directory } from './snapshot';
import type { CredentialChange } from './credential-commit';

export { readCredential } from './credential-commit';
export const createPasswordAccount = (handle: string, credential: CredentialRecord, profile = {}) =>
  createAccount(handle, profile, structuredClone(validateCredential(credential)));
export const writeAccountCredential = (accountId: string, handle: string, expected: CredentialRecord | null, next: CredentialRecord) => {
  const change: CredentialChange = { accountId, expected: expected ? structuredClone(validateCredential(expected)) : null, next: structuredClone(validateCredential(next)) };
  return enqueue(async base => {
    if (!base) throw new LocalAuthError('identity_changed');
    const directory = await readFile<Directory>(base, 'shared/accounts.json');
    if (!directory.accounts.some(account => account.accountId === accountId && account.handle === handle)) throw new LocalAuthError('identity_changed');
    return { changes: new Map(), accountId, credentialChange: change };
  });
};
