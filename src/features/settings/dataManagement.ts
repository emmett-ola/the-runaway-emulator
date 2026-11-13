import type { HitLog, UserData } from '../../types';
import { getSavedTimezone } from '../../timezone';
import { getTheme } from '../../darkMode';
import { getCalendarTheme } from '../../lib/storage/preferences';

export const combineImportedHits = (current: HitLog[], incoming: HitLog[]): HitLog[] => {
  const ids = new Set(current.map(hit => hit.id));
  return [...current, ...incoming.filter(hit => {
    if (ids.has(hit.id)) return false;
    ids.add(hit.id);
    return true;
  })];
};

export const exportUserData = (userData: UserData): void => {
  const exportData: UserData = {
    ...userData,
    settings: {
      ...userData.settings,
      timezone: getSavedTimezone(),
      theme: getCalendarTheme(),
      darkMode: getTheme(),
    },
  };
  const dataBlob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(dataBlob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `runawaylog-${userData.username}-${new Date().toISOString().split('T')[0]}.json`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

export const importUserData = (file: File): Promise<UserData> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = event => {
      try {
        const userData = JSON.parse(event.target?.result as string) as UserData;
        if (!userData || typeof userData.username !== 'string' || !userData.username || !Array.isArray(userData.hits)) {
          throw new Error('Invalid data format');
        }
        for (const hit of userData.hits) {
          if (!hit || typeof hit.id !== 'string' || !hit.id || !Number.isFinite(hit.timestamp) || typeof hit.date !== 'string' || !hit.date) {
            throw new Error('Invalid hit data format');
          }
        }
        resolve(userData);
      } catch (error) {
        reject(error instanceof Error ? error : new Error('Failed to parse JSON file'));
      }
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsText(file);
  });
};
