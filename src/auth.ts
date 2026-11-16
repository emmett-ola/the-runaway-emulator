import type { AccountSnapshot } from './lib/storage';
import { createPasswordAccount, ensureRunView, getAccountSnapshot, initializeStorage, readCredential, readStore, writeAccountCredential } from './lib/storage';
import { getSavedTimezone } from './lib/time';
import { readIdentityCache, writeIdentityCache, removeIdentityCache, clearObsoleteAuthCache } from './lib/storage/preferences';
import { createCredential, LocalAuthError, PASSWORD_ITERATIONS, validatePassword, validVerificationInput, verifyPassword } from './lib/identity/password';
export { LocalAuthError } from './lib/identity/password';

export type LocalIdentity = { username: string; accountId: string | null; step: 'password' | 'setup' };
const attempts = new Map<string, { failures: number; until: number }>();
const verifications = new Map<string, Promise<unknown>>();
const serialVerification = <T>(id: string, operation: () => Promise<T>): Promise<T> => {
  const result = (verifications.get(id) ?? Promise.resolve()).catch(() => undefined).then(operation);
  verifications.set(id, result);
  void result.finally(() => { if (verifications.get(id) === result) verifications.delete(id); }).catch(() => undefined);
  return result;
};
export const lookupLocalIdentity = async (username: string): Promise<LocalIdentity> => {
  if (!username.trim()) throw new LocalAuthError('username_required');
  await initializeStorage();
  clearObsoleteAuthCache();
  const users = (await readStore()).users;
  const account = Object.hasOwn(users, username) ? users[username] : null;
  const credential = account ? await readCredential(account.accountId) : null;
  return { username, accountId: account?.accountId ?? null, step: credential ? 'password' : 'setup' };
};
const enterSession = async (username: string, accountId: string): Promise<AccountSnapshot> => {
  const account = Object.values((await readStore()).users).find(value => value.accountId === accountId);
  if (!account || account.username !== username) throw new LocalAuthError('identity_changed');
  await ensureRunView(account.accountId, getSavedTimezone(), new Date());
  clearObsoleteAuthCache();
  writeIdentityCache('currentUser', JSON.stringify({ username: account.username }));
  writeIdentityCache('username', account.username);
  return account;
};
export const loadCurrentUser = (): AccountSnapshot | null => {
  const raw = readIdentityCache('currentUser');
  if (!raw) return null;
  try {
    const value: unknown = JSON.parse(raw);
    return value && typeof value === 'object' && 'username' in value && typeof value.username === 'string' ? getAccountSnapshot(value.username) : null;
  } catch { return null; }
};
export const isAuthenticated = (): boolean => loadCurrentUser() !== null;
export const login = async (username: string, password: string, expected?: LocalIdentity): Promise<AccountSnapshot> => {
  const identity = await lookupLocalIdentity(username);
  if (expected && (expected.accountId !== identity.accountId || expected.username !== identity.username || expected.step !== identity.step)) throw new LocalAuthError('identity_changed');
  if (!identity.accountId || identity.step !== 'password') throw new LocalAuthError('setup_required');
  const accountId = identity.accountId;
  return serialVerification(accountId, async () => {
    const state = attempts.get(accountId);
    if (state?.until && Date.now() < state.until) throw new LocalAuthError('cooldown');
    if (state?.until && Date.now() >= state.until) attempts.delete(accountId);
    const credential = await readCredential(accountId);
    if (!credential) throw new LocalAuthError('identity_changed');
    if (!validVerificationInput(password)) throw new LocalAuthError('invalid_credentials');
    if (!await verifyPassword(password, credential)) {
      const failures = (attempts.get(accountId)?.failures ?? 0) + 1;
      attempts.set(accountId, { failures, until: failures >= 5 ? Date.now() + 30_000 : 0 });
      throw new LocalAuthError(failures >= 5 ? 'cooldown' : 'invalid_credentials');
    }
    const next = credential.iterations < PASSWORD_ITERATIONS ? await createCredential(password, credential) : credential;
    // Guard even a non-upgrade against a credential/account changed while deriving.
    await writeAccountCredential(accountId, username, credential, next);
    const account = await enterSession(username, accountId);
    attempts.delete(accountId);
    return account;
  });
};
export const setupLocalPassword = async (identity: LocalIdentity, password: string, confirmation: string): Promise<AccountSnapshot> => {
  validatePassword(password, confirmation);
  const current = await lookupLocalIdentity(identity.username);
  if (current.accountId !== identity.accountId || current.step !== 'setup' || identity.step !== 'setup') throw new LocalAuthError('identity_changed');
  const credential = await createCredential(password);
  const receipt = identity.accountId
    ? await writeAccountCredential(identity.accountId, identity.username, null, credential)
    : await createPasswordAccount(identity.username, credential);
  return enterSession(identity.username, receipt.accountId!);
};
/** Registration is explicit password setup, never passwordless account entry. */
export const register = async (username: string, password: string, email?: string): Promise<AccountSnapshot> => {
  validatePassword(password);
  const identity = await lookupLocalIdentity(username);
  if (identity.accountId) throw new LocalAuthError('identity_changed');
  const receipt = await createPasswordAccount(username, await createCredential(password), email ? { email } : {});
  return enterSession(username, receipt.accountId!);
};
export const logout = (): void => {
  removeIdentityCache('username'); removeIdentityCache('currentUser'); clearObsoleteAuthCache();
};
