import { useEffect, useRef, useState } from 'react';
import { login, setupLocalPassword, type LocalIdentity } from '../auth';
import { getStorageState, type AccountSnapshot } from '../lib/storage';
import { i18n, useT } from '../lib/i18n';

const errorCodes = new Set([
  'username_required', 'password_too_short', 'password_too_long', 'password_invalid_unicode',
  'confirmation_mismatch', 'invalid_credentials', 'cooldown', 'credential_invalid',
  'identity_changed', 'setup_required', 'storage_failed',
]);
export function LoginError({ reason }: { reason: unknown }) {
  useT();
  const code = reason && typeof reason === 'object' && 'code' in reason && typeof reason.code === 'string' ? reason.code : '';
  const key = errorCodes.has(code) ? `login.error.${code}` : getStorageState().status === 'blocked' ? 'recovery.blocked' : 'login.error.login_failed';
  return <div className="login-error" role="alert">{i18n.t(key)}</div>;
}
interface LoginPasswordProps {
  identity: LocalIdentity;
  onBack: () => void;
  onAuthenticated: (account: AccountSnapshot) => void;
}
export function LoginPassword({ identity, onBack, onAuthenticated }: LoginPasswordProps) {
  useT();
  const setup = identity.step === 'setup';
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [error, setError] = useState<unknown>(null);
  const [loading, setLoading] = useState(false);
  const mounted = useRef(false);
  const submitting = useRef(false);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (submitting.current) return;
    submitting.current = true;
    setLoading(true);
    setError(null);
    try {
      const account = setup ? await setupLocalPassword(identity, password, confirmation) : await login(identity.username, password, identity);
      if (!mounted.current) return;
      setPassword(''); setConfirmation('');
      onAuthenticated(account);
    } catch (reason: unknown) { if (mounted.current) setError(reason); }
    finally { submitting.current = false; if (mounted.current) setLoading(false); }
  };
  const handleBack = () => { setPassword(''); setConfirmation(''); setError(null); onBack(); };
  return (
    <form onSubmit={handleSubmit}>
      <div className="login-form-group">
        <label htmlFor="login-identity" className="login-label">{i18n.t('login.username')}</label>
        <input id="login-identity" name="username" className="login-input" value={identity.username} autoComplete="username" readOnly />
      </div>
      {setup && <p className="login-notice">{i18n.t('login.setup_notice')}</p>}
      <p className="login-notice">{i18n.t('login.device_notice')}</p>
      {error !== null && <LoginError reason={error} />}
      <div className="login-form-group">
        <label htmlFor="password" className="login-label">{i18n.t('login.password')}</label>
        <input id="password" name="password" type="password" className="login-input"
          value={password} onChange={event => setPassword(event.target.value)} placeholder={i18n.t('login.placeholder_password')}
          autoComplete={setup ? 'new-password' : 'current-password'} aria-describedby={setup ? 'login-password-rules' : undefined} autoFocus disabled={loading} />
        {setup && <p id="login-password-rules" className="login-notice">{i18n.t('login.password_rules')}</p>}
      </div>
      {setup && <div className="login-form-group">
        <label htmlFor="confirmation" className="login-label">{i18n.t('login.confirm_password')}</label>
        <input id="confirmation" name="confirmation" type="password" className="login-input"
          value={confirmation} onChange={event => setConfirmation(event.target.value)}
          placeholder={i18n.t('login.placeholder_confirmation')} autoComplete="new-password" disabled={loading} />
      </div>}
      <button type="submit" className="login-button" disabled={loading}>
        {i18n.t(loading ? 'login.loading' : setup ? 'login.setup_button' : 'login.button')}
      </button>
      <div className="login-toggle"><button type="button" className="login-toggle-button" onClick={handleBack} disabled={loading}>{i18n.t('login.back')}</button></div>
    </form>
  );
}
