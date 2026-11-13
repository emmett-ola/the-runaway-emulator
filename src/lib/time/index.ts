export { formatDate, formatMonth, formatLongDate, formatNumber, formatClock, hourInTimezone, calendarWeekdays, formatMemberDuration } from './format';

import { i18n, getLocaleMetadata } from '../i18n';
import { getTimezonePreference, setTimezonePreference } from '../storage/preferences';

// Get list of common timezones
export const getTimezones = (): string[] => {
  const commonTimezones = [
    'UTC',
    'America/New_York',
    'America/Chicago',
    'America/Denver',
    'America/Los_Angeles',
    'America/Anchorage',
    'Pacific/Honolulu',
    'America/Toronto',
    'America/Mexico_City',
    'America/Sao_Paulo',
    'Europe/London',
    'Europe/Paris',
    'Europe/Berlin',
    'Europe/Rome',
    'Europe/Madrid',
    'Europe/Moscow',
    'Africa/Cairo',
    'Africa/Johannesburg',
    'Asia/Dubai',
    'Asia/Kolkata',
    'Asia/Shanghai',
    'Asia/Tokyo',
    'Asia/Seoul',
    'Asia/Hong_Kong',
    'Asia/Singapore',
    'Australia/Sydney',
    'Australia/Melbourne',
    'Pacific/Auckland',
  ];

  // Ensure browser timezone is in the list
  const browserTz = getBrowserTimezone();
  if (!commonTimezones.includes(browserTz)) {
    return [browserTz, ...commonTimezones];
  }

  return commonTimezones;
};

// Get browser's timezone
export const getBrowserTimezone = (): string => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return 'UTC';
  }
};

// Get saved timezone or default to browser timezone
export const getSavedTimezone = (): string => {
  try {
    const saved = getTimezonePreference();
    if (saved) {
      return saved;
    }
    
    // First time: save browser timezone and return it
    const browserTz = getBrowserTimezone();
    saveTimezone(browserTz);
    return browserTz;
  } catch {
    return getBrowserTimezone();
  }
};

// Save timezone to localStorage
export const saveTimezone = (timezone: string): void => {
  try {
    setTimezonePreference(timezone);
  } catch (error) {
    console.error('Error saving timezone:', error);
  }
};

// Convert timestamp to date string in specified timezone
export const timestampToDateString = (timestamp: number, timezone: string): string => {
  const date = new Date(timestamp);
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  
  const parts = formatter.formatToParts(date);
  const year = parts.find(p => p.type === 'year')?.value;
  const month = parts.find(p => p.type === 'month')?.value;
  const day = parts.find(p => p.type === 'day')?.value;
  
  return `${year}-${month}-${day}`;
};

// Get current timestamp in UTC
export const getCurrentTimestamp = (): number => {
  return Date.now();
};

// Format date for display in specified timezone
export const formatDateInTimezone = (timestamp: number, timezone: string, language?: string): string => {
  const metadata = getLocaleMetadata(language ?? i18n.getLanguage());
  return new Date(timestamp).toLocaleString(metadata.logTag, {
    timeZone: timezone,
    year: 'numeric',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    ...metadata.logOptions,
  });
};

// Get timezone display name
export const getTimezoneDisplayName = (timezone: string): string => {
  try {
    // Get offset
    const offset = getTimezoneOffset(timezone);
    const offsetStr = formatOffset(offset);
    
    return `${timezone.replace(/_/g, ' ')} (${offsetStr})`;
  } catch {
    return timezone;
  }
};

// Get timezone offset in minutes
const getTimezoneOffset = (timezone: string): number => {
  const now = new Date();
  const tzDate = new Date(now.toLocaleString('en-US', { timeZone: timezone }));
  const utcDate = new Date(now.toLocaleString('en-US', { timeZone: 'UTC' }));
  return (tzDate.getTime() - utcDate.getTime()) / (1000 * 60);
};

// Format offset as string (e.g., "UTC+8" or "UTC-5")
const formatOffset = (offsetMinutes: number): string => {
  if (offsetMinutes === 0) return 'UTC+0';
  
  const hours = Math.floor(Math.abs(offsetMinutes) / 60);
  const minutes = Math.abs(offsetMinutes) % 60;
  const sign = offsetMinutes > 0 ? '+' : '-';
  
  if (minutes === 0) {
    return `UTC${sign}${hours}`;
  }
  return `UTC${sign}${hours}:${minutes.toString().padStart(2, '0')}`;
};
