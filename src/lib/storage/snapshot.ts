import { timestampToDateString } from '../time';
import { accountPath, readFile, verifyTree } from './files';
import { validateChunk, validateIndex } from './chunks';
import { validateDirectory, validateEnvelope, validateGames, validateIdentity, validateProfile, validateSettings } from './envelope-validation';
import { StorageError } from './idb';
import { publishPreferences, validatePreferences } from './preferences';
import { decodeImportSources } from './source-codec';
import type { UserRecord, UserSettings, GameSettings, Hit } from './model';
import type { AccountSnapshot, Chunk, DevicePreferences, Envelope, Generation, Manifest, ProfilePayload, RunIndex, RunView, StorageState, StoreSnapshot } from './state-model';

export interface Directory { schemaVersion: 1; recordVersion: string; accounts: { accountId: string; handle: string; registeredAt: number }[] }
export interface Identity { handle: string; registeredAt: number; extensions: unknown }
export interface GamesPayload { settings: GameSettings; cardCollections: Record<string, number>; [key: string]: unknown }
const listeners = new Set<() => void>();
let state: StorageState = Object.freeze({ status: 'booting', revision: '0', diagnostics: [] });
let store: StoreSnapshot = Object.freeze({ schemaVersion: 2, users: Object.freeze({}) });
const views = new Map<string, RunView>();
export const freeze = <T>(value: T): T => {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    Object.values(value).forEach(child => freeze(child));
  }
  return value;
};
export const subscribe = (listener: () => void): (() => void) => { listeners.add(listener); return () => listeners.delete(listener); };
const notify = (): void => listeners.forEach(listener => listener());
export const getStorageState = (): StorageState => state;
export const getStoreSnapshot = (): StoreSnapshot => store;
export const getAccountSnapshot = (id: string): AccountSnapshot | null => Object.values(store.users).find(account => account.accountId === id || account.username === id) ?? null;
export const requireReady = (): void => {
  if (state.status !== 'ready') throw new StorageError(state.status, state.diagnostics.map(item => item.message).join('; ') || 'Storage is not ready.');
};
export const blockStorage = (error: unknown): void => {
  state = freeze({ ...state, status: 'blocked', diagnostics: [{ code: error instanceof StorageError ? error.code : 'storage', message: error instanceof Error ? error.message : String(error) }] });
  notify();
};
export const publishEmpty = (): void => {
  store = freeze({ schemaVersion: 2, users: {} });
  state = freeze({ status: 'ready', revision: '0', diagnostics: [] });
  notify();
};
export const hydrateAccount = async (generation: Generation, id: string): Promise<AccountSnapshot> => {
  const root = accountPath(id);
  const [account, profile, settings, games, index, extensions, imports] = await Promise.all([
    readFile<Envelope<Identity>>(generation, `${root}/account.json`), readFile<Envelope<ProfilePayload>>(generation, `${root}/profile.json`),
    readFile<Envelope<UserSettings>>(generation, `${root}/settings.json`), readFile<Envelope<GamesPayload> & { pluginId: string }>(generation, `${root}/plugins/games.json`), readFile<RunIndex>(generation, `${root}/run/index.json`),
    readFile<Envelope>(generation, `${root}/extensions.json`), readFile<Envelope>(generation, `${root}/imports/index.json`),
  ]);
  for (const envelope of [account, profile, settings, games, extensions, imports]) {
    validateEnvelope(envelope, id, generation.revision);
    if (!Object.hasOwn(envelope, 'payload')) throw new StorageError('canonical', 'Canonical entity payload is missing.');
  }
  if (!Array.isArray(imports.payload)) throw new StorageError('canonical', 'Invalid canonical import source index.');
  validateIdentity(account.payload);
  validateProfile(profile.payload);
  validateSettings(settings.payload);
  validateGames(games.payload);
  if (games.pluginId !== 'games') throw new StorageError('plugin', 'Unregistered games plugin envelope.');
  validateIndex(index, id);
  if (BigInt(index.sourceRevision) > BigInt(generation.revision)) throw new StorageError('canonical', 'Run index source revision exceeds its generation.');
  const manifest = await readFile<Manifest>(generation, 'manifest.json');
  for (const chunk of index.chunks) {
    const file = manifest.files.find(value => value.path === chunk.path);
    if (!file || chunk.path !== `${root}/run/${chunk.partition}-${String(chunk.sequence).padStart(6, '0')}.json` || file.sha256 !== chunk.sha256 || file.bytes !== chunk.bytes || file.fileVersion !== chunk.fileVersion || file.module !== chunk.module || file.schemaVersion !== chunk.schemaVersion) throw new StorageError('index-descriptor', 'Index and manifest chunk descriptors disagree.');
  }
  if (manifest.files.filter(file => file.path.startsWith(`${root}/run/`) && !file.path.endsWith('/index.json')).length !== index.chunks.length) throw new StorageError('index-membership', 'Run index omits a chunk.');
  return freeze({ accountId: id, username: account.payload.handle, registeredAt: account.payload.registeredAt,
    profile: { ...profile.payload.fields, ...(profile.payload.email === undefined ? {} : { email: profile.payload.email }) }, settings: { ...settings.payload, games: games.payload.settings }, cardCollections: games.payload.cardCollections, total: index.total, index });
};
export const publishGeneration = async (generation: Generation): Promise<void> => {
  const changed = new Set(Object.keys(generation.map).filter(path => !/\/(?:run\/y|imports\/i-)/.test(path)));
  await verifyTree(generation, changed);
  const [directory, preferences] = await Promise.all([readFile<Directory>(generation, 'shared/accounts.json'), readFile<DevicePreferences>(generation, 'device/preferences.json')]);
  validateDirectory(directory, generation.revision);
  validatePreferences(preferences);
  const users: Record<string, AccountSnapshot> = Object.create(null);
  const ids = new Set<string>();
  for (const entry of directory.accounts) {
    if (ids.has(entry.accountId) || Object.hasOwn(users, entry.handle)) throw new StorageError('directory', 'Duplicate directory identity.');
    const account = await hydrateAccount(generation, entry.accountId);
    if (account.username !== entry.handle || account.registeredAt !== entry.registeredAt) throw new StorageError('directory', 'Directory and account identity disagree.');
    ids.add(entry.accountId);
    users[entry.handle] = account;
  }
  // A slower cross-tab hydration must never replace a newer local receipt.
  if (BigInt(generation.revision) < BigInt(state.revision)) return;
  store = freeze({ schemaVersion: 2, users });
  state = freeze({ status: 'ready', revision: generation.revision, diagnostics: [] });
  views.clear();
  publishPreferences(preferences);
  notify();
};
export const monthKey = (month: Date | string): string => typeof month === 'string' ? month : `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, '0')}`;
const viewKey = (id: string, timezone: string, month: Date | string): string => `${id}|${timezone}|${monthKey(month)}`;
export const getRunView = (id: string, timezone: string, month: Date | string): RunView | null => {
  const account = getAccountSnapshot(id);
  return account ? views.get(viewKey(account.accountId, timezone, month)) ?? null : null;
};
export const buildRunView = async (generation: Generation, id: string, timezone: string, month: Date | string): Promise<RunView> => {
  const account = await hydrateAccount(generation, id);
  const dayCounts: Record<string, number> = {};
  const key = monthKey(month);
  for (const frequency of account.index.timestamps) {
    const day = timestampToDateString(frequency.at, timezone);
    if (day.startsWith(`${key}-`)) dayCounts[day] = (dayCounts[day] ?? 0) + frequency.count;
  }
  const chunks = new Map<string, Chunk>();
  for (const path of new Set(account.index.recent.map(ref => ref.path))) {
    const chunk = await readFile<Chunk>(generation, path);
    validateChunk(chunk, account.index.chunks.find(value => value.path === path)!, id);
    chunks.set(path, chunk);
  }
  const recentHits: Hit[] = account.index.recent.map(ref => {
    const entry = chunks.get(ref.path)?.entries.find(value => value.ordinal === ref.ordinal);
    if (!entry || entry.hit.at !== ref.at) throw new StorageError('recent', 'Recent reference does not match its authoritative hit.');
    return entry.hit;
  });
  return freeze({ accountId: id, revision: generation.revision, timezone, month: key, total: account.total, firstAt: account.index.firstAt,
    timestamps: account.index.timestamps, dayCounts, recentHits });
};
export const publishRunView = (view: RunView): void => {
  if (view.revision !== state.revision) return;
  const key = viewKey(view.accountId, view.timezone, view.month);
  if (views.get(key)?.revision === view.revision) return;
  views.set(key, view);
  notify();
};
export const readFullFrom = async (generation: Generation, id: string): Promise<UserRecord> => {
  const account = await hydrateAccount(generation, id);
  const entries: Chunk['entries'] = [];
  for (const descriptor of account.index.chunks) {
    const chunk = await readFile<Chunk>(generation, descriptor.path);
    validateChunk(chunk, descriptor, id);
    entries.push(...chunk.entries);
  }
  const extensions = await readFile<Envelope<Record<string, unknown>>>(generation, `${accountPath(id)}/extensions.json`);
  const imports = await readFile<Envelope<{ importId: string; path: string; sourceDigest: string }[]>>(generation, `${accountPath(id)}/imports/index.json`);
  validateEnvelope(imports, id, generation.revision);
  const payloads: unknown[] = [];
  for (const entry of imports.payload) {
    const source = await readFile<Envelope>(generation, entry.path);
    validateEnvelope(source, id, generation.revision);
    payloads.push(source.payload);
  }
  const importBackups = await decodeImportSources(payloads);
  return { ...extensions.payload, accountId: id, username: account.username, registeredAt: account.registeredAt, profile: account.profile,
    settings: account.settings, cardCollections: account.cardCollections, hits: entries.sort((a, b) => a.ordinal - b.ordinal).map(entry => entry.hit),
    ...(importBackups.length ? { importBackups } : {}) };
};
export const resetSnapshots = (): void => {
  state = Object.freeze({ status: 'booting', revision: '0', diagnostics: [] });
  store = Object.freeze({ schemaVersion: 2, users: Object.freeze({}) });
  views.clear();
};
