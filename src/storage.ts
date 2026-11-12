import type { UserData, HitLog } from './types';
import { getCurrentTimestamp, timestampToDateString, getSavedTimezone } from './timezone';
import { loadToken } from './auth';
import { readRecord, writeRecord, deleteRecord } from './lib/storage';

// Storage types
export type StorageMode = 'local' | 'cloud';

// Storage interface
export interface StorageAdapter {
  loadUserData(username: string): Promise<UserData | null>;
  saveUserData(userData: UserData): Promise<void>;
  addHit(username: string): Promise<HitLog | null>;
  syncData(username: string): Promise<void>;
  deleteUserData(username: string): Promise<void>;
}

const STORAGE_MODE_KEY = 'runawaylog-storage-mode';

// Mock API URLs - these would be replaced with actual API endpoints in production
// const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api';

/**
 * Get the current storage mode from localStorage
 */
export const getStorageMode = (): StorageMode => {
  try {
    const mode = localStorage.getItem(STORAGE_MODE_KEY) as StorageMode;
    return mode || 'local';
  } catch (error) {
    console.error('Error getting storage mode:', error);
    return 'local';
  }
};

/**
 * Save the storage mode to localStorage
 */
export const setStorageMode = (mode: StorageMode): void => {
  try {
    localStorage.setItem(STORAGE_MODE_KEY, mode);
  } catch (error) {
    console.error('Error setting storage mode:', error);
  }
};

/**
 * LocalStorage adapter implementation
 */
export class LocalStorageAdapter implements StorageAdapter {
  async loadUserData(username: string): Promise<UserData | null> {
    try {
      const userData = readRecord(username);
      
      if (!userData) return null;
      
      // Migrate old data: recalculate date field based on timestamp and current timezone
      const timezone = getSavedTimezone();
      let needsSave = false;
      
      const migratedHits = userData.hits.map(hit => {
        const correctDate = timestampToDateString(hit.timestamp, timezone);
        if (hit.date !== correctDate) {
          needsSave = true;
          return { ...hit, date: correctDate };
        }
        return hit;
      });
      
      if (needsSave) {
        const migratedData = { ...userData, hits: migratedHits };
        await this.saveUserData(migratedData);
        return migratedData;
      }
      
      return userData;
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
      const userData = await this.loadUserData(username) || { 
        username, 
        hits: [],
        profile: {
          registrationDate: Date.now(),
        }
      };
      
      // Ensure profile exists with registration date for existing users
      if (!userData.profile) {
        userData.profile = {
          registrationDate: Date.now(),
        };
      }
      
      // Store timestamp in UTC (Date.now() is always UTC)
      const timestamp = getCurrentTimestamp();
      const timezone = getSavedTimezone();
      
      const newHit: HitLog = {
        id: `${timestamp}-${Math.random()}`,
        timestamp: timestamp,
        date: timestampToDateString(timestamp, timezone),
      };
      
      userData.hits.push(newHit);
      await this.saveUserData(userData);
      
      return newHit;
    } catch (error) {
      console.error('Error adding hit to local storage:', error);
      return null;
    }
  }

  async syncData(_username: string): Promise<void> {
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

/**
 * CloudStorage adapter implementation
 */
export class CloudStorageAdapter implements StorageAdapter {
  // Token will be used when actual API calls are implemented
  constructor() {
    // Load token for future use when API calls are implemented
    loadToken();
  }

  async loadUserData(username: string): Promise<UserData | null> {
    try {
      // For now, we'll use a mock implementation
      // In production, this would make an API call to the backend
      
      // Simulate API call delay
      await new Promise(resolve => setTimeout(resolve, 300));
      
      // Mock response - replace with actual API response
      return readRecord(username);
    } catch (error) {
      console.error('Error loading user data from cloud storage:', error);
      return null;
    }
  }

  async saveUserData(userData: UserData): Promise<void> {
    try {
      // For now, we'll use a mock implementation
      // In production, this would make an API call to the backend
      
      // Simulate API call delay
      await new Promise(resolve => setTimeout(resolve, 300));
      
      // Also save to local storage as backup
      const localAdapter = new LocalStorageAdapter();
      await localAdapter.saveUserData(userData);
    } catch (error) {
      console.error('Error saving user data to cloud storage:', error);
      throw error;
    }
  }

  async addHit(username: string): Promise<HitLog | null> {
    try {
      // For now, we'll use a mock implementation
      // In production, this would make an API call to the backend
      
      // Simulate API call delay
      await new Promise(resolve => setTimeout(resolve, 300));
      
      // Also add to local storage for offline support
      const localAdapter = new LocalStorageAdapter();
      return await localAdapter.addHit(username);
    } catch (error) {
      console.error('Error adding hit to cloud storage:', error);
      return null;
    }
  }

  async syncData(_username: string): Promise<void> {
    try {
      // For now, we'll use a mock implementation
      // In production, this would handle data synchronization between local and cloud
      
      // Simulate API call delay
      await new Promise(resolve => setTimeout(resolve, 500));
      
      console.log('Data synced successfully');
    } catch (error) {
      console.error('Error syncing data:', error);
      throw error;
    }
  }

  async deleteUserData(username: string): Promise<void> {
    try {
      // For now, we'll use a mock implementation
      // In production, this would make an API call to the backend
      
      // Simulate API call delay
      await new Promise(resolve => setTimeout(resolve, 300));
      
      // Also delete from local storage
      const localAdapter = new LocalStorageAdapter();
      await localAdapter.deleteUserData(username);
    } catch (error) {
      console.error('Error deleting user data from cloud storage:', error);
      throw error;
    }
  }
}

/**
 * Storage factory to create the appropriate storage adapter based on the current mode
 */
export const createStorageAdapter = (mode?: StorageMode): StorageAdapter => {
  const storageMode = mode || getStorageMode();
  
  switch (storageMode) {
    case 'cloud':
      return new CloudStorageAdapter();
    case 'local':
    default:
      return new LocalStorageAdapter();
  }
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
