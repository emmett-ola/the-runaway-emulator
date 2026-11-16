import { useState } from 'react';
import { readIdentityCache, removeIdentityCache, writeIdentityCache, clearObsoleteAuthCache } from '../lib/storage/preferences';

export const getSessionUsername = (): string | null => { clearObsoleteAuthCache(); return readIdentityCache('username'); };
export const clearSession = (): void => {
  removeIdentityCache('username');
  removeIdentityCache('currentUser');
  clearObsoleteAuthCache();
};

export function useSession() {
  const [username, setUsername] = useState<string | null>(getSessionUsername);
  const handleLogin = (user: string) => {
    writeIdentityCache('username', user);
    setUsername(user);
  };
  const handleLogout = () => {
    clearSession();
    setUsername(null);
  };
  return { username, handleLogin, handleLogout };
}
