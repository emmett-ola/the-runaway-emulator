import type { UserData, HitLog } from './types';
import { getCurrentTimestamp } from './lib/time';
import { getStorageMode, setStorageMode, type StorageMode } from './lib/storage/preferences';
export { getStorageMode, setStorageMode } from './lib/storage/preferences';
export type { StorageMode } from './lib/storage/preferences';
import { readRecord, writeRecord, deleteRecord } from './lib/storage';

// Storage interface
export interface StorageAdapter {
  loadUserData(username: string): Promise<UserData | null>;
  saveUserData(userData: UserData): Promise<void>;
  addHit(username: string): Promise<HitLog | null>;
  syncData(username: string): Promise<void>;
  deleteUserData(username: string): Promise<void>;
}

/**
 * LocalStorage adapter implementation
 */
export class LocalStorageAdapter implements StorageAdapter {
  async loadUserData(username: string): Promise<UserData | null> {
    try {
      return readRecord(username);
    } catch (error) {
      console.error('Error loading user data from local storage:', error);
      return null;
    }
  }

  async saveUserData(userData: UserData): Promise<void> {
    try {
      writeRecord(userData);
    } catch (error) {
      console.error('Error saving user data to local storage:', error);
    }
  }

  async addHit(username: string): Promise<HitLog | null> {
    try {
      // Read directly so a blocked migration cannot be mistaken for a missing user.
      const userData = readRecord(username) || { username, registeredAt: Date.now(), hits: [] };
      const at = getCurrentTimestamp();
      const newHit: HitLog = { id: crypto.randomUUID(), at };
      writeRecord({ ...userData, hits: [...userData.hits, newHit] });
      
      return newHit;
    } catch (error) {
      console.error('Error adding hit to local storage:', error);
      return null;
    }
  }

  async syncData(): Promise<void> {
    // No-op for local storage
    return;
  }

  async deleteUserData(username: string): Promise<void> {
    try {
      deleteRecord(username);
    } catch (error) {
      console.error('Error deleting user data from local storage:', error);
    }
  }
}

export class CloudStorageAdapter extends LocalStorageAdapter {}

/** Cloud remains unavailable even when an old caller requests it explicitly. */
export const createStorageAdapter = (mode?: StorageMode): StorageAdapter => {
  if (mode) setStorageMode(mode);
  else getStorageMode();
  return new LocalStorageAdapter();
};

// Export default storage adapter instance
const storage = createStorageAdapter();

export default storage;

// Keep backward compatibility with existing code
export const loadUserData = (username: string): Promise<UserData | null> => {
  return storage.loadUserData(username);
};

export const saveUserData = (userData: UserData): Promise<void> => {
  return storage.saveUserData(userData);
};

export const addHit = (username: string): Promise<HitLog | null> => {
  return storage.addHit(username);
};

export const syncData = (username: string): Promise<void> => {
  return storage.syncData(username);
};

export const deleteUserData = (username: string): Promise<void> => {
  return storage.deleteUserData(username);
};
