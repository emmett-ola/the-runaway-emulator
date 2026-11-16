import type { AccountSnapshot } from './lib/storage';
import { createAccount, ensureRunView, getAccountSnapshot, initializeStorage, readRecord } from './lib/storage';
import { getSavedTimezone } from './lib/time';
import { readIdentityCache, writeIdentityCache, removeIdentityCache } from './lib/storage/preferences';

export type AuthStatus = 'logged_out' | 'logging_in' | 'logged_in' | 'registering';
export type TokenData = { accessToken: string; refreshToken: string; expiresAt: number };
export type AuthContextType = {
  authStatus: AuthStatus;
  currentUser: AccountSnapshot | null;
  login: (username: string, password: string) => Promise<void>;
  register: (username: string, password: string, email?: string) => Promise<void>;
  logout: () => void;
  token: string | null;
};

// Local identity is demo-only and tab-scoped; legacy caches are never read.
export const saveToken = (token: string, expiresAt: number): void => {
  writeIdentityCache('token', JSON.stringify({ token, expiresAt }));
};

export const loadToken = (): string | null => {
  const raw = readIdentityCache('token');
  if (!raw) return null;
  let value: unknown;
  try { value = JSON.parse(raw); } catch { return null; }
  if (!value || typeof value !== 'object' || !('token' in value) || typeof value.token !== 'string'
    || !('expiresAt' in value) || typeof value.expiresAt !== 'number' || value.expiresAt <= Date.now()) return null;
  return value.token;
};

export const removeToken = (): void => {
  removeIdentityCache('token');
  removeIdentityCache('currentUser');
};

export const saveCurrentUser = (userData: { username: string }): void => {
  writeIdentityCache('currentUser', JSON.stringify({ username: userData.username }));
};

export const loadCurrentUser = (): AccountSnapshot | null => {
  const raw = readIdentityCache('currentUser');
  if (!raw) return null;
  let identity: unknown;
  try { identity = JSON.parse(raw); } catch { return null; }
  return identity && typeof identity === 'object' && 'username' in identity && typeof identity.username === 'string'
    ? getAccountSnapshot(identity.username) : null;
};

export const isAuthenticated = (): boolean => !!loadToken();

async function hydrateAccount(username: string): Promise<AccountSnapshot> {
  const account = await readRecord(username);
  if (!account) throw new Error('Account not found');
  await ensureRunView(account.accountId, getSavedTimezone(), new Date());
  return account;
}

/** Preserve the existing insecure demo check; this is not real authentication. */
const hashPassword = (password: string): string => {
  let hash = 0;
  for (const byte of new TextEncoder().encode(password)) {
    hash = ((hash << 5) - hash) + byte;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(16).padStart(8, '0');
};

const readCredentials = (): Record<string, string> => {
  const raw = readIdentityCache('credentials');
  if (!raw) return {};
  const value: unknown = JSON.parse(raw);
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid demo credentials');
  const credentials: Record<string, string> = {};
  for (const [username, hash] of Object.entries(value)) {
    if (typeof hash !== 'string') throw new Error('Invalid demo credentials');
    Object.defineProperty(credentials, username, { value: hash, enumerable: true, writable: true, configurable: true });
  }
  return credentials;
};

const saveCredentials = (username: string, password: string): void => {
  writeIdentityCache('credentials', JSON.stringify({ ...readCredentials(), [username]: hashPassword(password) }));
};

const enterDemoSession = (account: AccountSnapshot): void => {
  saveToken(`mock-jwt-token-${account.username}-${Date.now()}`, Date.now() + 24 * 60 * 60 * 1000);
  saveCurrentUser(account);
};

/** Empty-password entry retains the shipped local-demo bypass. */
export const login = async (username: string, password: string): Promise<AccountSnapshot> => {
  await initializeStorage();
  const existing = await readRecord(username);
  if (!existing) {
    await createAccount(username);
    if (password.trim()) saveCredentials(username, password);
  } else if (password.trim()) {
    const credentials = readCredentials();
    const storedHash = Object.prototype.hasOwnProperty.call(credentials, username) ? credentials[username] : undefined;
    if (!storedHash || storedHash !== hashPassword(password)) throw new Error('Invalid username or password');
  }
  const account = await hydrateAccount(username);
  enterDemoSession(account);
  return account;
};

export const register = async (username: string, password: string, email?: string): Promise<AccountSnapshot> => {
  if (password.length < 6) throw new Error('Password must be at least 6 characters long');
  await initializeStorage();
  const credentials = readCredentials();
  if (Object.prototype.hasOwnProperty.call(credentials, username) || await readRecord(username)) throw new Error('Username already exists');
  await createAccount(username, email ? { email } : undefined);
  saveCredentials(username, password);
  const account = await hydrateAccount(username);
  enterDemoSession(account);
  return account;
};

export const logout = (): void => {
  removeToken();
  removeIdentityCache('username');
};
