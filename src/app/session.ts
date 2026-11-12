import { useState } from 'react';

export function useSession() {
  const [username, setUsername] = useState<string | null>(() => {
    return sessionStorage.getItem('runawaylog-username');
  });

  const handleLogin = (user: string) => {
    setUsername(user);
    sessionStorage.setItem('runawaylog-username', user);
  };

  const handleLogout = () => {
    setUsername(null);
    sessionStorage.removeItem('runawaylog-username');
  };

  return { username, handleLogin, handleLogout };
}
