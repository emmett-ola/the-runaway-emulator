import { useNavigate } from 'react-router-dom';
import { Layout } from '../../ui/Layout';
import { i18n, useT } from '../../lib/i18n';

export const CardGame = () => {
  useT();
  const navigate = useNavigate();
  const username = sessionStorage.getItem('runawaylog-username') || '';
  
  const handleLogout = () => {
    sessionStorage.removeItem('runawaylog-username');
    navigate('/');
    window.location.reload();
  };

  return (
    <Layout username={username} onLogout={handleLogout}>
    <div style={{ 
      minHeight: 'calc(100vh - 80px)', 
      background: 'linear-gradient(135deg, var(--bg-gradient-start) 0%, var(--bg-gradient-end) 100%)',
      padding: '3rem 2rem',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    }}>
      <div style={{ 
        background: 'var(--bg-primary)', 
        padding: '3rem', 
        borderRadius: '20px',
        boxShadow: 'var(--shadow-lg)',
        textAlign: 'center',
        maxWidth: '600px'
      }}>
        <button type="button" onClick={() => navigate('/games')}>{i18n.t('games.hub_title')}</button>
        <div style={{ fontSize: '5rem', marginBottom: '1rem' }}>🃏</div>
        <h1 style={{ fontSize: '2.5rem', marginBottom: '1rem', color: 'var(--text-primary)' }}>
          {i18n.t('games.card_game_title')}
        </h1>
        <p style={{ fontSize: '1.2rem', color: 'var(--text-secondary)', marginBottom: '2rem' }}>
          {i18n.t('games.card_game_description')}
        </p>
        <div style={{ 
          background: 'var(--bg-secondary)', 
          padding: '1.5rem', 
          borderRadius: '12px',
          marginBottom: '1rem'
        }}>
          <h3 style={{ color: 'var(--text-primary)', marginBottom: '0.5rem' }}>{i18n.t('games.card_game_features')}</h3>
          <ul style={{ 
            textAlign: 'left', 
            color: 'var(--text-secondary)',
            lineHeight: '1.8'
          }}>
            <li>{i18n.t('games.card_game_feature_1')}</li>
            <li>{i18n.t('games.card_game_feature_2')}</li>
            <li>{i18n.t('games.card_game_feature_3')}</li>
            <li>{i18n.t('games.card_game_feature_4')}</li>
            <li>{i18n.t('games.card_game_feature_5')}</li>
          </ul>
        </div>
      </div>
    </div>
    </Layout>
  );
};
