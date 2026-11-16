import type { Generation, Manifest, RunView, StoreSnapshot, AccountSnapshot, VirtualFile } from './state-model';
import { closeDatabase, getGeneration, readBlob, readCurrent, StorageError } from './idb';
import { configurePreferences, getPreferencesSnapshot, resetPreferences } from './preferences';
import { setCommitNotification, flushWrites, resetQueue, resolveSnapshotId, updatePreferences } from './commands';
import { blockStorage, buildRunView, getAccountSnapshot, getRunView, getStorageState, getStoreSnapshot, publishEmpty, publishGeneration, publishRunView, readFullFrom, requireReady, resetSnapshots } from './snapshot';
import { pinGeneration, releasePin, renewPin } from './idb';
import { readFile, verifyBlob } from './files';
import { withPinnedGeneration } from './commit';

let initialization: Promise<void> | undefined;
let channel: BroadcastChannel | undefined;
let removeListeners: (() => void) | undefined;
const refresh = async (): Promise<void> => {
  if (getStorageState().status === 'blocked') return;
  const current = await readCurrent();
  if (current && current.revision !== getStorageState().revision) {
    await withPinnedGeneration(async generation => {
      // Committed immutable references were verified before publication. Normal
      // hydration verifies metadata/indexes; complete history audits are explicit.
      await publishGeneration(generation);
    });
  }
};
const reconcile = (): void => { void refresh().catch(blockStorage); };
const checkedRead = async <T>(operation: () => Promise<T>): Promise<T> => {
  try { return await operation(); }
  catch (error) { blockStorage(error); throw error; }
};
export const initializeStorage = (): Promise<void> => {
  initialization ??= (async () => {
    try {
      const current = await readCurrent();
      if (!current) publishEmpty();
      else await withPinnedGeneration(async generation => {
        await publishGeneration(generation);
        const { garbageCollect } = await import('./recovery');
        void garbageCollect().catch(() => undefined);
      });
      configurePreferences(updatePreferences);
      if (typeof window !== 'undefined') {
        window.addEventListener('focus', reconcile);
        document.addEventListener('visibilitychange', reconcile);
        removeListeners = () => { window.removeEventListener('focus', reconcile); document.removeEventListener('visibilitychange', reconcile); };
      }
      if (typeof BroadcastChannel !== 'undefined') {
        channel = new BroadcastChannel('runawaylog-vfiles-revision');
        channel.onmessage = reconcile;
      }
      setCommitNotification(() => { channel?.postMessage('revision'); });
    } catch (error) { initialization = undefined; blockStorage(error); throw error; }
  })();
  return initialization;
};
export const readStore = async (): Promise<StoreSnapshot> => { requireReady(); await checkedRead(refresh); return getStoreSnapshot(); };
export const readRecord = async (id: string): Promise<AccountSnapshot | null> => { await readStore(); return getAccountSnapshot(id); };
export const readFullRecord = async (id: string) => {
  await readStore();
  const accountId = resolveSnapshotId(id);
  return checkedRead(() => withPinnedGeneration(async generation => {
    const { verifyHealthyGeneration } = await import('./recovery');
    await verifyHealthyGeneration(generation);
    return readFullFrom(generation, accountId);
  }));
};
export const readRunView = async (id: string, timezone: string, month: Date | string): Promise<RunView> => {
  await readStore();
  const accountId = resolveSnapshotId(id);
  const cached = getRunView(accountId, timezone, month);
  if (cached) return cached;
  const view = await checkedRead(() => withPinnedGeneration(generation => buildRunView(generation, accountId, timezone, month)));
  publishRunView(view);
  if (view.revision !== getStorageState().revision) return readRunView(id, timezone, month);
  return view;
};
export const ensureRunView = async (id: string, timezone: string, month: Date | string): Promise<void> => { await readRunView(id, timezone, month); };
export const readPreferences = async () => { requireReady(); await refresh(); return getPreferencesSnapshot(); };
export const readManifest = (generation: Generation): Promise<Manifest> => readFile(generation, 'manifest.json');
export async function* iterateFiles(generation: Generation, paths?: readonly string[]): AsyncIterable<VirtualFile> {
  const pin = await pinGeneration(generation.id);
  try {
    const manifest = await readManifest(generation);
    const names = paths ? [...paths] : Object.keys(generation.map);
    names.sort((a, b) => a === 'manifest.json' ? -1 : b === 'manifest.json' ? 1 : a < b ? -1 : a > b ? 1 : 0);
    for (const path of names) {
      await renewPin(pin);
      const blobId = generation.map[path];
      if (!blobId) throw new StorageError('missing-file', `Missing virtual file: ${path}`);
      const blob = await readBlob(blobId);
      await verifyBlob(blob, path === 'manifest.json' ? undefined : manifest.files.find(file => file.path === path));
      yield { path, bytes: blob.bytes.slice() };
    }
  } catch (error) { blockStorage(error); throw error; }
  finally { await releasePin(pin); }
}
export const resetStorage = async (): Promise<void> => {
  await flushWrites();
  channel?.close(); channel = undefined;
  removeListeners?.(); removeListeners = undefined;
  await closeDatabase();
  initialization = undefined;
  resetQueue(); resetSnapshots(); resetPreferences();
};
export const getStorageDiagnostics = () => getStorageState().diagnostics;
export { getGeneration };
