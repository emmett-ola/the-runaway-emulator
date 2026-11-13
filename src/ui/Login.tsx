import { useState, useEffect, useRef } from 'react';
import { animate } from 'animejs';
import { i18n, type SupportedLanguage } from '../lib/i18n';
import { login } from '../auth';
import './Login.css';

interface LoginProps {
  onLogin: (username: string) => void;
}

export const Login = ({ onLogin }: LoginProps) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [selectedLanguage, setSelectedLanguage] = useState(i18n.getLanguage());
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (containerRef.current) {
      animate(containerRef.current, {
        opacity: [0, 1],
        translateY: [-20, 0],
        duration: 800,
        ease: 'out(3)',
      });
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    if (!username.trim()) {
      setError(i18n.t('login.error.username_required'));
      return;
    }
    
    setLoading(true);
    
    try {
      // 登录时不需要密码，使用默认密码
      await login(username.trim(), '');
      
      onLogin(username.trim());
    } catch (err: unknown) {
      // Handle specific error messages
      let errorMessage = '';
      if (typeof err === 'object' && err !== null && 'message' in err && err.message === 'Invalid username or password') {
        errorMessage = i18n.t('login.error.invalid_credentials');
      } else {
        errorMessage = i18n.t('login.error.login_failed');
      }
      setError(errorMessage);
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleLanguageChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newLanguage = e.target.value as SupportedLanguage;
    setSelectedLanguage(newLanguage);
    i18n.setLanguage(newLanguage);
  };

  return (
    <div className="login-container" ref={containerRef}>
      <div className="login-card">
        <div className="login-language-selector">
          <select 
            value={selectedLanguage} 
            onChange={handleLanguageChange} 
            className="language-select"
            aria-label={i18n.t('login.select_language')}
          >
            {i18n.getSupportedLanguages().map(lang => (
              <option key={lang.code} value={lang.code}>
                {lang.name}
              </option>
            ))}
          </select>
        </div>
        
        <h1 className="login-title">{i18n.t('login.title')}</h1>
        <p className="login-subtitle">{i18n.t('login.subtitle')}</p>
        <p className="login-slogan">"{i18n.t('login.slogan')}"</p>
        
        {error && <div className="login-error">{error}</div>}
        
        <form onSubmit={handleSubmit}>
          <div className="login-form-group">
            <label htmlFor="username" className="login-label">
              {i18n.t('login.username')}
            </label>
            <input
              id="username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder={i18n.t('login.placeholder_username')}
              className="login-input"
              autoFocus
              maxLength={20}
              disabled={loading}
            />
          </div>
          
          <div className="login-form-group">
            <label htmlFor="password" className="login-label">
              {i18n.t('login.password')}
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={i18n.t('login.passwordless_login')}
              className="login-input disabled"
              disabled={true}
            />
          </div>
          
          <button type="submit" className="login-button" disabled={loading}>
            {loading ? i18n.t('login.loading') : i18n.t('login.button')}
          </button>
        </form>
      </div>
    </div>
  );
};
