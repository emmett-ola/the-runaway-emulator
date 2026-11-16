import { useNavigate } from 'react-router-dom';
import { Layout } from '../../ui/Layout';
import { i18n, useT } from '../../lib/i18n';
import { readIdentityCache } from '../../lib/storage';
import { logout as clearIdentity } from '../../auth';
import { formatLongDate } from '../../lib/time';

const entries = [
  { version: '2.0.0', date: '2026-11-16', prefix: 'v200', items: 7 },
  { version: '1.1.0', date: '2025-12-08', prefix: 'v110', items: 6 },
  { version: '1.0.0', date: '2025-12-02', prefix: 'v100', items: 9 },
];

export function Releases() {
  useT();
  const navigate = useNavigate();
  const username = readIdentityCache('username') || '';
  const logout = () => {
    clearIdentity();
    navigate('/');
    window.location.reload();
  };
  return <Layout username={username} onLogout={logout}>
    <div className="settings-page"><div className="settings-container">
      <h1 className="settings-title">{i18n.t('releases.title')}</h1>
      <p>{i18n.t('releases.subtitle')}</p>
      {entries.map(entry => <article className="settings-card" key={entry.version}>
        <span>v{entry.version}</span>{' '}
        <time dateTime={entry.date}>{formatLongDate(new Date(`${entry.date}T12:00:00Z`), 'UTC')}</time>
        <h2>{i18n.t(`releases.${entry.prefix}_title`)}</h2>
        <ul>{Array.from({ length: entry.items }, (_, index) => <li key={index}>{i18n.t(`releases.${entry.prefix}_${index + 1}`)}</li>)}</ul>
      </article>)}
    </div></div>
  </Layout>;
}
