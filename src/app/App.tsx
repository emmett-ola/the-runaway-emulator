import { useEffect, useState } from 'react';
import { BrowserRouter } from 'react-router-dom';
import { Login } from '../ui/Login';
import { RecoveryPanel } from '../ui/RecoveryPanel';
import { AppRoutes } from './routes';
import { useSession } from './session';
import { SceneSession } from '../features/scene';
import { useDocumentMeta } from './useDocumentMeta';
import { ensureRunView, initializeStorage, readRecord } from '../lib/storage';
import { useStorageState } from '../storage';
import { getSavedTimezone } from '../lib/time';
import { i18n } from '../lib/i18n';
import { initTheme } from '../darkMode';
import { applyTheme, getThemeById } from '../themes';
import { getCalendarTheme } from '../lib/storage/preferences';
import '../App.css';

function AppContent() {
  const { username, handleLogin, handleLogout } = useSession();
  const storageState = useStorageState();
  const [hydrated, setHydrated] = useState(false);
  const [bootAttempt, setBootAttempt] = useState(0);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    const boot = async () => {
      await initializeStorage();
      i18n.hydrateLanguage();
      initTheme();
      applyTheme(getThemeById(getCalendarTheme()));
      if (username) {
        const account = await readRecord(username);
        if (account) await ensureRunView(account.accountId, getSavedTimezone(), new Date());
        else if (active) handleLogout();
      }
      if (active) { setError(''); setHydrated(true); }
    };
    setHydrated(false);
    void boot().catch((reason: unknown) => {
      if (active) setError(reason instanceof Error ? reason.message : String(reason));
    });
    return () => { active = false; };
    // Session commands only change username; do not restart hydration per render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [username, bootAttempt]);

  if (storageState.status === 'blocked') {
    return <div className="login-container"><RecoveryPanel onRestored={() => { setError(''); setBootAttempt(value => value + 1); }} /></div>;
  }
  if (error) return <p role="alert">{i18n.t('errors.storage_failed')}</p>;
  if (!hydrated || storageState.status !== 'ready') return <div role="status">{i18n.t('profile.loading')}</div>;
  if (!username) return <Login onLogin={handleLogin} />;
  return <div className="app"><AppRoutes username={username} handleLogout={handleLogout} /></div>;
}

function App() {
  useDocumentMeta();
  return <SceneSession><BrowserRouter><AppContent /></BrowserRouter></SceneSession>;
}

export default App;
