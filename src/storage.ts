import { useEffect, useState, useSyncExternalStore } from 'react';
import type { AccountSnapshot, Hit, RunView } from './lib/storage';
import { appendHit, deleteRecord, ensureRunView, flushWrites, getAccountSnapshot, getRunView, getStorageState, readRecord, subscribe } from './lib/storage';
import { getCurrentTimestamp } from './lib/time';
export { getStorageMode, setStorageMode } from './lib/storage/preferences';
export type { StorageMode } from './lib/storage/preferences';
export { updateProfile, updateSettings, updatePlugin } from './lib/storage';

/** Compatibility facade: all persistence points inward to the repository. */
export interface StorageAdapter {
  loadUserData(idOrHandle: string): Promise<AccountSnapshot | null>;
  addHit(idOrHandle: string): Promise<Hit>;
  syncData(idOrHandle?: string): Promise<void>;
  deleteUserData(idOrHandle: string): Promise<void>;
}

export class LocalStorageAdapter implements StorageAdapter {
  loadUserData(idOrHandle: string): Promise<AccountSnapshot | null> {
    return readRecord(idOrHandle);
  }

  async addHit(idOrHandle: string): Promise<Hit> {
    // Allocate once before the repository queues/rebases this intent.
    const hit: Hit = { id: crypto.randomUUID(), at: getCurrentTimestamp(), schemaVersion: 1, recordVersion: '1' };
    const account = await readRecord(idOrHandle);
    if (!account) throw new Error('Account not found');
    await appendHit(account.accountId, hit);
    return hit;
  }

  syncData(): Promise<void> {
    return flushWrites();
  }

  async deleteUserData(idOrHandle: string): Promise<void> {
    const account = await readRecord(idOrHandle);
    if (!account) throw new Error('Account not found');
    await deleteRecord(account.accountId);
  }
}

export class CloudStorageAdapter extends LocalStorageAdapter {}
export const createStorageAdapter = (mode?: import('./lib/storage/preferences').StorageMode): StorageAdapter => {
  void mode; // Cloud is unavailable; compatibility callers still receive local storage.
  return new LocalStorageAdapter();
};
const storage = createStorageAdapter();
export default storage;
export const loadUserData = (idOrHandle: string): Promise<AccountSnapshot | null> => storage.loadUserData(idOrHandle);
export const addHit = (idOrHandle: string): Promise<Hit> => storage.addHit(idOrHandle);
export const syncData = (): Promise<void> => storage.syncData();
export const deleteUserData = (idOrHandle: string): Promise<void> => storage.deleteUserData(idOrHandle);

export function useStorageState() {
  return useSyncExternalStore(subscribe, getStorageState, getStorageState);
}

export function useAccountSnapshot(idOrHandle: string): AccountSnapshot | null {
  const getSnapshot = () => getAccountSnapshot(idOrHandle);
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

/** Observation is synchronous; selective hydration only runs in an effect. */
export function useRunView(accountId: string | undefined, timezone: string, month: Date) {
  const state = useStorageState();
  const monthKey = `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, '0')}`;
  const [error, setError] = useState<string>('');
  const getSnapshot = (): RunView | null => accountId ? getRunView(accountId, timezone, monthKey) : null;
  const view = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  useEffect(() => {
    if (!accountId || state.status !== 'ready') return;
    let active = true;
    ensureRunView(accountId, timezone, monthKey).then(() => {
      if (active) setError('');
    }).catch((reason: unknown) => {
      if (active) setError(reason instanceof Error ? reason.message : String(reason));
    });
    return () => { active = false; };
  }, [accountId, timezone, monthKey, state.revision, state.status]);
  return { view, error, loading: !view };
}
