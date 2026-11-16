import { useState, useEffect, useRef } from 'react';
import { animate } from 'animejs';
import { i18n, useT, type SupportedLanguage } from '../lib/i18n';
import { lookupLocalIdentity, type LocalIdentity } from '../auth';
import { useStorageState } from '../storage';
import { RecoveryPanel } from './RecoveryPanel';
import { LoginError, LoginPassword } from './LoginPassword';
import './Login.css';

interface LoginProps { onLogin: (username: string) => void }
export const Login = ({ onLogin }: LoginProps) => {
  useT();
  const [username, setUsername] = useState('');
  const [identity, setIdentity] = useState<LocalIdentity | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [loading, setLoading] = useState(false);
  const storageState = useStorageState();
  const containerRef = useRef<HTMLDivElement>(null);
  const mounted = useRef(false);
  const submitting = useRef(false);
  useEffect(() => {
    mounted.current = true;
    if (containerRef.current) animate(containerRef.current, { opacity: [0, 1], translateY: [-20, 0], duration: 800, ease: 'out(3)' });
    return () => { mounted.current = false; };
  }, []);
  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (submitting.current) return;
    setError(null);
    if (!username.trim()) { setError({ code: 'username_required' }); return; }
    submitting.current = true;
    setLoading(true);
    try {
      const next = await lookupLocalIdentity(username.trim());
      if (mounted.current) setIdentity(next);
    } catch (reason: unknown) { if (mounted.current) setError(reason); }
    finally { submitting.current = false; if (mounted.current) setLoading(false); }
  };
  const handleLanguageChange = async (event: React.ChangeEvent<HTMLSelectElement>) => {
    try { await i18n.setLanguage(event.target.value as SupportedLanguage); }
    catch (reason: unknown) { if (mounted.current) setError(reason); }
  };
  if (storageState.status === 'blocked') return <div className="login-container"><RecoveryPanel /></div>;
  return (
    <div className="login-container" ref={containerRef}>
      <div className="login-card">
        <div className="login-language-selector">
          <select value={i18n.getLanguage()} onChange={handleLanguageChange}
            className="language-select" aria-label={i18n.t('login.select_language')}>
            {i18n.getSupportedLanguages().map(language => <option key={language.code} value={language.code}>{language.name}</option>)}
          </select>
        </div>
        <h1 className="login-title">{i18n.t('login.title')}</h1>
        <p className="login-subtitle">{i18n.t('login.subtitle')}</p>
        <p className="login-slogan">"{i18n.t('login.slogan')}"</p>
        {error !== null && <LoginError reason={error} />}
        {identity ? (
          <LoginPassword key={`${identity.accountId ?? 'new'}:${identity.username}:${identity.step}`} identity={identity}
            onBack={() => { setIdentity(null); setError(null); }}
            onAuthenticated={account => { setIdentity(null); setError(null); onLogin(account.username); }} />
        ) : (
          <form onSubmit={handleSubmit}>
            <div className="login-form-group">
              <label htmlFor="username" className="login-label">{i18n.t('login.username')}</label>
              <input id="username" name="username" type="text" value={username}
                onChange={event => setUsername(event.target.value)} placeholder={i18n.t('login.placeholder_username')}
                className="login-input" autoComplete="username" autoFocus maxLength={20} disabled={loading} />
            </div>
            <button type="submit" className="login-button" disabled={loading}>{i18n.t(loading ? 'login.loading' : 'login.next')}</button>
          </form>
        )}
      </div>
    </div>
  );
};
