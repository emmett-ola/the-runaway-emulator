import { useState } from 'react';
import { readIdentityCache, removeIdentityCache, writeIdentityCache } from '../lib/storage/preferences';

export const getSessionUsername = (): string | null => readIdentityCache('username');
export const clearSession = (): void => {
  removeIdentityCache('username');
  removeIdentityCache('currentUser');
  removeIdentityCache('token');
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
