import { useNavigate } from 'react-router-dom';
import { Layout } from '../../ui/Layout';
import { i18n, useT } from '../../lib/i18n';

const entries = [
  { version: '1.1.0', date: '2025-12-08', prefix: 'v110', items: 6 },
  { version: '1.0.0', date: '2025-12-02', prefix: 'v100', items: 9 },
];

export function Releases() {
  useT();
  const navigate = useNavigate();
  const username = sessionStorage.getItem('runawaylog-username') || '';
  const locale = { en_us: 'en-US', zh_cn: 'zh-CN', zh_tw: 'zh-TW' }[i18n.getLanguage()];
  const logout = () => {
    sessionStorage.removeItem('runawaylog-username');
    navigate('/');
    window.location.reload();
  };
  return <Layout username={username} onLogout={logout}>
    <div className="settings-page"><div className="settings-container">
      <h1 className="settings-title">{i18n.t('releases.title')}</h1>
      <p>{i18n.t('releases.subtitle')}</p>
      {entries.map(entry => <article className="settings-card" key={entry.version}>
        <span>v{entry.version}</span>{' '}
        <time dateTime={entry.date}>{new Date(`${entry.date}T12:00:00Z`).toLocaleDateString(locale, { timeZone: 'UTC', year: 'numeric', month: 'long', day: 'numeric' })}</time>
        <h2>{i18n.t(`releases.${entry.prefix}_title`)}</h2>
        <ul>{Array.from({ length: entry.items }, (_, index) => <li key={index}>{i18n.t(`releases.${entry.prefix}_${index + 1}`)}</li>)}</ul>
      </article>)}
    </div></div>
  </Layout>;
}
