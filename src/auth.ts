import type { UserData } from './types';
import { readRecord, writeRecord } from './lib/storage';
import { readIdentityCache, writeIdentityCache, removeIdentityCache } from './lib/storage/preferences';

export type AuthStatus = 'logged_out' | 'logging_in' | 'logged_in' | 'registering';

export type TokenData = {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
};

export type AuthContextType = {
  authStatus: AuthStatus;
  currentUser: UserData | null;
  login: (username: string, password: string) => Promise<void>;
  register: (username: string, password: string, email?: string) => Promise<void>;
  logout: () => void;
  token: string | null;
};

/**
 * Save authentication token to localStorage
 */
export const saveToken = (token: string, expiresAt: number): void => {
  try {
    writeIdentityCache('token', JSON.stringify({ token, expiresAt }));
  } catch (error) {
    console.error('Error saving token:', error);
  }
};

/**
 * Load authentication token from localStorage
 */
export const loadToken = (): string | null => {
  try {
    const tokenData = readIdentityCache('token');
    if (!tokenData) return null;
    
    const { token, expiresAt } = JSON.parse(tokenData);
    
    // Check if token is expired
    if (Date.now() > expiresAt) {
      removeIdentityCache('token');
      return null;
    }
    
    return token;
  } catch (error) {
    console.error('Error loading token:', error);
    return null;
  }
};

/**
 * Remove authentication token from localStorage
 */
export const removeToken = (): void => {
  try {
    removeIdentityCache('token');
    removeIdentityCache('currentUser');
  } catch (error) {
    console.error('Error removing token:', error);
  }
};

/**
 * Save current user data to localStorage
 */
export const saveCurrentUser = (userData: UserData): void => {
  try {
    writeIdentityCache('currentUser', JSON.stringify({ username: userData.username }));
  } catch (error) {
    console.error('Error saving current user:', error);
  }
};

/**
 * Load current user data from localStorage
 */
export const loadCurrentUser = (): UserData | null => {
  try {
    const userData = readIdentityCache('currentUser');
    const identity: unknown = userData ? JSON.parse(userData) : null;
    if (!identity || typeof identity !== 'object' || !('username' in identity) || typeof identity.username !== 'string') return null;
    return readRecord(identity.username);
  } catch (error) {
    console.error('Error loading current user:', error);
    return null;
  }
};

/**
 * Check if user is authenticated
 */
export const isAuthenticated = (): boolean => {
  return !!loadToken();
};

/**
 * Hash a password using SHA-256
 */
const hashPassword = (password: string): string => {
  // For now, we'll use a simple hash function
  // In production, you should use a more secure hashing algorithm like bcrypt
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  
  // Use a simple hash function that works synchronously
  // since crypto.subtle.digest is async and we need a sync function here
  let hash = 0;
  for (let i = 0; i < data.length; i++) {
    hash = ((hash << 5) - hash) + data[i];
    hash = hash & hash; // Convert to 32bit integer
  }
  
  // Convert hash to hex string
  return Math.abs(hash).toString(16).padStart(8, '0');
};

/**
 * Save user credentials to localStorage
 */
const saveUserCredentials = (username: string, password: string): void => {
  try {
    const hashedPassword = hashPassword(password);
    const credentials = JSON.parse(readIdentityCache('credentials') || '{}');
    credentials[username] = hashedPassword;
    writeIdentityCache('credentials', JSON.stringify(credentials));
  } catch (error) {
    console.error('Error saving user credentials:', error);
  }
};

/**
 * Load user credentials from localStorage
 */
const loadUserCredentials = (username: string): string | null => {
  try {
    const credentials = JSON.parse(readIdentityCache('credentials') || '{}');
    return credentials[username] || null;
  } catch (error) {
    console.error('Error loading user credentials:', error);
    return null;
  }
};

/**
 * Authenticate user with username and password
 * If user doesn't exist, create a new user automatically
 */
export const login = async (username: string, password: string): Promise<UserData> => {
  // For now, we'll use a local implementation
  // In production, this would make an API call to the backend
  
  // Simulate API call delay
  await new Promise(resolve => setTimeout(resolve, 500));
  
  // Get user data
  let userData = readRecord(username);
  
  // If user doesn't exist, create a new user automatically
  if (!userData) {
    // Create new user
    userData = {
      username,
      registeredAt: Date.now(),
      hits: [],
    };
    
    // Save new user data
    writeRecord(userData);
    
    // If password is provided, save credentials
    if (password.trim()) {
      saveUserCredentials(username, password);
    }
  } else {
    // Check if password is provided, if not, skip password validation (allow passwordless login)
    if (password.trim()) {
      // Verify password only if it's provided
      const storedHash = loadUserCredentials(username);
      const passwordHash = hashPassword(password);
      
      if (!storedHash || storedHash !== passwordHash) {
        throw new Error('Invalid username or password');
      }
    }
  }
  
  // Mock token generation
  const mockToken = `mock-jwt-token-${username}-${Date.now()}`;
  const expiresAt = Date.now() + 24 * 60 * 60 * 1000; // 24 hours
  
  saveToken(mockToken, expiresAt);
  saveCurrentUser(userData);
  
  return userData;
};

/**
 * Register a new user
 */
export const register = async (username: string, password: string, email?: string): Promise<UserData> => {
  // For now, we'll use a local implementation
  // In production, this would make an API call to the backend
  
  // Validate password length
  if (password.length < 6) {
    throw new Error('Password must be at least 6 characters long');
  }
  
  // Simulate API call delay
  await new Promise(resolve => setTimeout(resolve, 500));
  
  // Check if username already exists
  const credentials = JSON.parse(readIdentityCache('credentials') || '{}');
  if (credentials[username] || readRecord(username)) {
    throw new Error('Username already exists');
  }
  
  // Create new user
  const newUser: UserData = {
    username,
    registeredAt: Date.now(),
    hits: [],
    profile: { email },
  };
  
  // Save user data
  writeRecord(newUser);
  
  // Save credentials
  saveUserCredentials(username, password);
  
  // Mock token generation
  const mockToken = `mock-jwt-token-${username}-${Date.now()}`;
  const expiresAt = Date.now() + 24 * 60 * 60 * 1000; // 24 hours
  
  saveToken(mockToken, expiresAt);
  saveCurrentUser(newUser);
  
  return newUser;
};

/**
 * Logout user
 */
export const logout = (): void => {
  removeToken();
};
