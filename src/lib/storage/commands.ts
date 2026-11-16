import type { Hit, UserProfile, UserSettings } from './model';
import type { BlobRecord, CommitReceipt, DevicePreferences, Envelope, Generation } from './state-model';
import { accountPath, makeBlob, readFile } from './files';
import { appendChunk, chunkPath, emptyIndex, utcPartition } from './chunks';
import { buildCandidate, getDeviceId, publishCandidate, withPinnedGeneration } from './commit';
import { ConflictError, getGeneration, readCurrent, StorageError } from './idb';
import { blockStorage, getAccountSnapshot, getStorageState, hydrateAccount, publishGeneration, requireReady } from './snapshot';
import type { Directory, GamesPayload, Identity } from './snapshot';
import { getPreferencesSnapshot, publishPreferences, validatePreferences } from './preferences';

let queue: Promise<void> = Promise.resolve();
let afterCommit: (() => void) | undefined;
export const setCommitNotification = (notify: () => void): void => { afterCommit = notify; };
type Intent = (base: Generation | null, revision: string) => Promise<{ changes: Map<string, BlobRecord | null>; accountId?: string }>;
const fatal = (error: unknown): boolean => error instanceof StorageError && ['integrity', 'descriptor', 'manifest-digest', 'missing-file', 'missing-blob', 'membership', 'index', 'ownership', 'index-descriptor', 'current'].includes(error.code);
const enqueue = (intent: Intent): Promise<CommitReceipt> => {
  const operation = queue.then(async () => {
    requireReady();
    for (let attempt = 0; attempt < 16; attempt++) {
      try {
        const current = await readCurrent();
        const execute = async (base: Generation | null) => {
          const revision = String(BigInt(base?.revision ?? '0') + 1n);
          const result = await intent(base, revision);
          const candidate = await buildCandidate(base, result.changes, await getDeviceId() ?? crypto.randomUUID());
          await publishCandidate(candidate);
          return { candidate, accountId: result.accountId };
        };
        const { candidate, accountId } = current ? await withPinnedGeneration(execute, false) : await execute(null);
        const generation = await getGeneration(candidate.generation.id);
        await publishGeneration(generation);
        afterCommit?.();
        // Collection is maintenance, not part of a saved receipt. A failed GC cannot
        // turn an already committed command into a fabricated write failure.
        const { garbageCollect } = await import('./recovery');
        void garbageCollect().catch(() => undefined);
        return { generation: generation.id, revision: generation.revision, ...(accountId ? { accountId } : {}) };
      } catch (error) {
        if (error instanceof ConflictError) continue;
        if (fatal(error)) blockStorage(error);
        throw error;
      }
    }
    throw new StorageError('contention', 'Storage changed too frequently; retry this command.');
  });
  queue = operation.then(() => undefined, () => undefined);
  return operation;
};
export const flushWrites = (): Promise<void> => queue;
export const resetQueue = (): void => { queue = Promise.resolve(); afterCommit = undefined; };
const envelope = <T>(id: string, payload: T, revision: string, now = Date.now()): Envelope<T> => ({ accountId: id, schemaVersion: 1, recordVersion: revision, createdAt: now, updatedAt: now, payload });
export const createAccount = (handle: string, profile: UserProfile = {}): Promise<CommitReceipt> => {
  const id = crypto.randomUUID();
  const registeredAt = Date.now();
  if (!handle.trim()) return Promise.reject(new StorageError('handle', 'A local handle is required.'));
  return enqueue(async (base, revision) => {
    const changes = new Map<string, BlobRecord | null>();
    const directory: Directory = base ? await readFile(base, 'shared/accounts.json') : { schemaVersion: 1, recordVersion: revision, accounts: [] };
    const existing = directory.accounts.find(account => account.handle === handle);
    if (existing) return { changes, accountId: existing.accountId };
    if (directory.accounts.some(account => account.accountId === id)) throw new StorageError('collision', 'Account UUID collision; retry account creation.');
    const root = accountPath(id);
    const identity: Identity = { handle, registeredAt, extensions: {} };
    const files: [string, unknown][] = [
      [`${root}/account.json`, envelope(id, identity, revision, registeredAt)],
      [`${root}/profile.json`, envelope(id, { fields: Object.fromEntries(Object.entries(profile).filter(([key]) => key !== 'email')), emailVerification: 'unverified', ...(profile.email === undefined ? {} : { email: profile.email }) }, revision, registeredAt)],
      [`${root}/settings.json`, envelope(id, {}, revision, registeredAt)], [`${root}/extensions.json`, envelope(id, {}, revision, registeredAt)],
      [`${root}/plugins/games.json`, { ...envelope(id, { settings: {}, cardCollections: {} }, revision, registeredAt), pluginId: 'games' }],
      [`${root}/run/index.json`, emptyIndex(id, revision)], [`${root}/imports/index.json`, envelope(id, [], revision, registeredAt)],
      ['shared/accounts.json', { ...directory, recordVersion: revision, accounts: [...directory.accounts, { accountId: id, handle, registeredAt }] }],
    ];
    if (!base) files.push(['shared/extensions.json', {}], ['shared/export-metadata.json', {}], ['device/preferences.json', getPreferencesSnapshot()]);
    for (const [path, value] of files) changes.set(path, await makeBlob(value, revision));
    return { changes, accountId: id };
  });
};
const resolveAccount = async (base: Generation | null, id: string) => {
  if (!base) throw new StorageError('missing-account', 'The account does not exist.');
  const directory = await readFile<Directory>(base, 'shared/accounts.json');
  const entry = directory.accounts.find(account => account.accountId === id);
  if (!entry) throw new StorageError('missing-account', 'The account does not exist.');
  return { base, root: accountPath(id) };
};
export const appendHit = (id: string, hit: Hit): Promise<CommitReceipt> => {
  // Freeze the original intent before it enters the queue; CAS retries never allocate a new hit.
  const immutableHit = structuredClone(hit);
  return enqueue(async (base, revision) => {
    const { base: generation, root } = await resolveAccount(base, id);
    const account = await hydrateAccount(generation, id);
    if (account.index.hitIds.includes(immutableHit.id)) throw new StorageError('duplicate-hit', 'Hit id already exists.');
    const partition = utcPartition(immutableHit.at);
    const tailDescriptor = account.index.chunks.filter(chunk => chunk.partition === partition).sort((a, b) => a.sequence - b.sequence).at(-1);
    const tail = tailDescriptor ? await readFile<import('./state-model').Chunk>(generation, chunkPath(id, partition, tailDescriptor.sequence)) : null;
    const result = await appendChunk(id, account.index, immutableHit, tail, revision);
    return { accountId: id, changes: new Map([[result.path, result.blob], [`${root}/run/index.json`, await makeBlob(result.index, revision)]]) };
  });
};
const patchEnvelope = <T extends Record<string, unknown>>(id: string, file: string, patch: Partial<T>): Promise<CommitReceipt> => {
  const intent = structuredClone(patch);
  return enqueue(async (base, revision) => {
    const { base: generation, root } = await resolveAccount(base, id);
    const path = `${root}/${file}`;
    const previous = await readFile<Envelope<T>>(generation, path);
    const payload = { ...previous.payload, ...intent };
    const next = { ...previous, recordVersion: revision, updatedAt: Date.now(), payload };
    return { accountId: id, changes: new Map([[path, await makeBlob(next, revision)]]) };
  });
};
export const updateExtensions = (id: string, patch: Record<string, unknown>): Promise<CommitReceipt> => patchEnvelope(id, 'extensions.json', patch);
export const updateProfile = (id: string, patch: UserProfile): Promise<CommitReceipt> => {
  const intent = structuredClone(patch);
  return enqueue(async (base, revision) => {
    const { base: generation, root } = await resolveAccount(base, id);
    const path = `${root}/profile.json`;
    const previous = await readFile<Envelope<import('./state-model').ProfilePayload>>(generation, path);
    const payload = { ...previous.payload, fields: { ...previous.payload.fields, ...Object.fromEntries(Object.entries(intent).filter(([key]) => key !== 'email')) } };
    if (Object.hasOwn(intent, 'email')) {
      if (intent.email === undefined) delete payload.email;
      else payload.email = intent.email;
    }
    return { accountId: id, changes: new Map([[path, await makeBlob({ ...previous, payload, recordVersion: revision, updatedAt: Date.now() }, revision)]]) };
  });
};
export const updateSettings = (id: string, patch: UserSettings): Promise<CommitReceipt> => {
  if (['games', 'timezone', 'theme', 'darkMode'].some(key => Object.hasOwn(patch, key))) return Promise.reject(new StorageError('settings', 'Plugin and device settings have separate owners.'));
  return patchEnvelope(id, 'settings.json', patch);
};
export const updatePlugin = (id: string, patch: Partial<GamesPayload>): Promise<CommitReceipt> => {
  const intent = structuredClone(patch);
  return enqueue(async (base, revision) => {
    const { base: generation, root } = await resolveAccount(base, id);
    const path = `${root}/plugins/games.json`;
    const previous = await readFile<Envelope<GamesPayload>>(generation, path);
    const payload = { ...previous.payload, ...intent, settings: { ...previous.payload.settings, ...intent.settings }, cardCollections: { ...previous.payload.cardCollections, ...intent.cardCollections } };
    return { accountId: id, changes: new Map([[path, await makeBlob({ ...previous, payload, recordVersion: revision, updatedAt: Date.now() }, revision)]]) };
  });
};
export const deleteRecord = (id: string): Promise<CommitReceipt> => enqueue(async (base, revision) => {
  const { base: generation, root } = await resolveAccount(base, id);
  const directory = await readFile<Directory>(generation, 'shared/accounts.json');
  const changes = new Map<string, BlobRecord | null>(Object.keys(generation.map).filter(path => path.startsWith(`${root}/`)).map(path => [path, null]));
  changes.set('shared/accounts.json', await makeBlob({ ...directory, recordVersion: revision, accounts: directory.accounts.filter(account => account.accountId !== id) }, revision));
  return { changes, accountId: id };
});
export const renameAccount = (id: string, handle: string): Promise<CommitReceipt> => enqueue(async (base, revision) => {
  const { base: generation, root } = await resolveAccount(base, id);
  const directory = await readFile<Directory>(generation, 'shared/accounts.json');
  if (!handle.trim() || directory.accounts.some(account => account.accountId !== id && account.handle === handle)) throw new StorageError('handle', 'Handle is empty or already in use.');
  const previous = await readFile<Envelope<Identity>>(generation, `${root}/account.json`);
  return { accountId: id, changes: new Map([
    [`${root}/account.json`, await makeBlob({ ...previous, payload: { ...previous.payload, handle }, recordVersion: revision, updatedAt: Date.now() }, revision)],
    ['shared/accounts.json', await makeBlob({ ...directory, recordVersion: revision, accounts: directory.accounts.map(account => account.accountId === id ? { ...account, handle } : account) }, revision)],
  ]) };
});
export const updatePreferences = async (patch: Partial<DevicePreferences>): Promise<CommitReceipt> => {
  requireReady();
  if (!await readCurrent()) {
    const next = { ...getPreferencesSnapshot(), ...patch, mode: 'local' as const };
    validatePreferences(next); publishPreferences(next);
    return { generation: 'volatile', revision: '0' };
  }
  return enqueue(async (base, revision) => {
    if (!base) throw new StorageError('current', 'The published store disappeared.');
    const previous = await readFile<DevicePreferences>(base, 'device/preferences.json');
    const next = { ...previous, ...patch, mode: 'local' as const };
    validatePreferences(next);
    return { changes: new Map([['device/preferences.json', await makeBlob(next, revision)]]) };
  });
};
export const resolveSnapshotId = (id: string): string => {
  requireReady();
  const account = getAccountSnapshot(id);
  if (!account) throw new StorageError('missing-account', 'The account does not exist.');
  return account.accountId;
};
export const currentRevision = (): string => getStorageState().revision;
