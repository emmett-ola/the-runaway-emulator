export const PASSWORD_ITERATIONS = 210_000;
export const PASSWORD_ALGORITHM = 'PBKDF2-HMAC-SHA-256';
export interface CredentialRecord {
  algorithm: typeof PASSWORD_ALGORITHM;
  iterations: number;
  saltB64: string;
  hashB64: string;
  createdAt: number;
  updatedAt: number;
}
export class LocalAuthError extends Error {
  code: string;
  constructor(code: string) { super(code); this.code = code; this.name = 'LocalAuthError'; }
}
const fail = (code: string): never => { throw new LocalAuthError(code); };
const invalidUnicode = (value: string): boolean => /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/u.test(value);
export const validVerificationInput = (password: string): boolean => password.length <= 1024 && !invalidUnicode(password) && new TextEncoder().encode(password).byteLength <= 1024;
export const validatePassword = (password: string, handle: string, confirmation = password): void => {
  // Bound input before counting or encoding. Preserve exact password bytes for the KDF.
  if (password.length > 1024) fail('password_too_long');
  if (invalidUnicode(password) || invalidUnicode(confirmation)) fail('password_invalid_unicode');
  if (new TextEncoder().encode(password).byteLength > 1024) fail('password_too_long');
  if (Array.from(password).length < 6) fail('password_too_short');
  const folded = password.trim().toLowerCase();
  if (folded === handle.trim().toLowerCase()) fail('password_same_as_handle');
  if (['123456', 'password', 'qwerty', '111111', '123123'].includes(folded)) fail('password_too_common');
  if (password !== confirmation) fail('confirmation_mismatch');
};
export const toBase64 = (bytes: Uint8Array): string => btoa(String.fromCharCode(...bytes));
const fromBase64 = (value: unknown, length: number): Uint8Array => {
  if (typeof value !== 'string' || value.length !== Math.ceil(length / 3) * 4 || !/^[A-Za-z0-9+/]+={0,2}$/.test(value)) return fail('credential_invalid');
  let bytes: Uint8Array;
  try { bytes = Uint8Array.from(atob(value), character => character.charCodeAt(0)); }
  catch { return fail('credential_invalid'); }
  if (bytes.length !== length || toBase64(bytes) !== value) return fail('credential_invalid');
  return bytes;
};
export const validateCredential = (value: unknown): CredentialRecord => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return fail('credential_invalid');
  const record = value as CredentialRecord;
  const keys = ['algorithm', 'iterations', 'saltB64', 'hashB64', 'createdAt', 'updatedAt'];
  if (Object.keys(value).length !== keys.length || keys.some(key => !Object.hasOwn(value, key))
    || record.algorithm !== PASSWORD_ALGORITHM || !Number.isInteger(record.iterations) || record.iterations < 1 || record.iterations > PASSWORD_ITERATIONS
    || !Number.isSafeInteger(record.createdAt) || record.createdAt < 0 || !Number.isSafeInteger(record.updatedAt) || record.updatedAt < record.createdAt || record.updatedAt > 8_640_000_000_000_000) return fail('credential_invalid');
  fromBase64(record.saltB64, 16); fromBase64(record.hashB64, 32);
  return record;
};
export const sameCredential = (a: CredentialRecord, b: CredentialRecord): boolean =>
  a.algorithm === b.algorithm && a.iterations === b.iterations && a.saltB64 === b.saltB64 && a.hashB64 === b.hashB64 && a.createdAt === b.createdAt && a.updatedAt === b.updatedAt;
const derive = async (password: string, salt: Uint8Array, iterations: number): Promise<Uint8Array> => {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
  return new Uint8Array(await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: salt as Uint8Array<ArrayBuffer>, iterations }, key, 256));
};
export const createCredential = async (password: string, previous?: CredentialRecord): Promise<CredentialRecord> => {
  const salt = previous ? fromBase64(validateCredential(previous).saltB64, 16) : crypto.getRandomValues(new Uint8Array(16));
  const now = Date.now();
  return validateCredential({ algorithm: PASSWORD_ALGORITHM, iterations: PASSWORD_ITERATIONS, saltB64: toBase64(salt), hashB64: toBase64(await derive(password, salt, PASSWORD_ITERATIONS)),
    createdAt: previous?.createdAt ?? now, updatedAt: previous ? Math.max(now, previous.updatedAt + 1) : now });
};
export const verifyPassword = async (password: string, value: CredentialRecord): Promise<boolean> => {
  const record = validateCredential(value);
  // Avoid unbounded allocations even through the public login API; empty is a failed verification.
  if (!validVerificationInput(password)) return false;
  const actual = await derive(password, fromBase64(record.saltB64, 16), record.iterations);
  const expected = fromBase64(record.hashB64, 32);
  let difference = 0;
  for (let index = 0; index < expected.length; index++) difference |= expected[index] ^ actual[index];
  return difference === 0; // Constant-time-ish byte loop; JS/WebCrypto provide no timing guarantee.
};
