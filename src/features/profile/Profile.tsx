import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Layout } from '../../ui/Layout';
import { useAccountSnapshot, updateProfile } from '../../storage';
import { readIdentityCache } from '../../lib/storage';
import { logout } from '../../auth';
import { getGravatarUrl } from './gravatar';
import { formatMemberSince } from './memberSince';
import { i18n, useT } from '../../lib/i18n';
import { formatLongDate } from '../../lib/time';
import './Profile.css';

export const Profile = () => {
  useT();
  const navigate = useNavigate();
  const username = readIdentityCache('username') || '';
  const userData = useAccountSnapshot(username);
  const [email, setEmail] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleLogout = () => {
    logout();
    navigate('/');
    window.location.reload();
  };

  useEffect(() => {
    if (!isEditing) setEmail(userData?.profile?.email || '');
  }, [userData, isEditing]);

  const handleSaveEmail = async () => {
    if (!userData || saving) return;
    setSaving(true);
    setError('');
    try {
      await updateProfile(userData.accountId, { email: email.trim() || undefined });
      setIsEditing(false);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setSaving(false);
    }
  };

  if (!userData) {
    return (
      <Layout username={username} onLogout={handleLogout}>
        <div className="profile-loading">{i18n.t('profile.loading')}</div>
      </Layout>
    );
  }

  const avatarUrl = getGravatarUrl(userData.profile?.email, 200, username);
  const registeredAt = userData.registeredAt;
  const memberSince = formatMemberSince(registeredAt);
  const joinDate = formatLongDate(registeredAt);

  return (
    <Layout username={username} onLogout={handleLogout}>
      <div className="profile-page">
        <div className="profile-container">
          <h1 className="profile-title">👤 {i18n.t('profile.title')}</h1>
          {error && <p role="alert">{error}</p>}

          <div className="profile-card">
            <div className="profile-header">
              <div className="profile-avatar-section">
                <img 
                  src={avatarUrl} 
                  alt={i18n.t('profile.avatar', { username })}
                  className="profile-avatar"
                />
              </div>

              <div className="profile-info">
                <h2 className="profile-username">{username}</h2>
                <div className="profile-stats">
                  <div className="profile-stat">
                    <span className="stat-icon">🏃</span>
                    <span className="stat-value">{userData.total}</span>
                    <span className="stat-label">{i18n.t('profile.escape_dreams')}</span>
                  </div>
                  <div className="profile-stat">
                    <span className="stat-icon">📅</span>
                    <span className="stat-value">{memberSince}</span>
                    <span className="stat-label">{i18n.t('profile.member_for')}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="profile-details">
              <div className="profile-field">
                <label className="field-label">
                  <span className="field-icon">📧</span>
                  {i18n.t('profile.email')}
                </label>
                {isEditing ? (
                  <div className="field-edit">
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="your@email.com"
                      className="field-input"
                    />
                    <div className="field-actions">
                      <button onClick={handleSaveEmail} disabled={saving} className="btn-save">
                        {i18n.t('profile.save')}
                      </button>
                      <button 
                        onClick={() => {
                          setEmail(userData.profile?.email || '');
                          setIsEditing(false);
                        }} 
                        className="btn-cancel"
                      >
                        {i18n.t('profile.cancel')}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="field-display">
                    <span className="field-value">
                      {userData.profile?.email || i18n.t('profile.not_set')}
                    </span>
                    <button onClick={() => setIsEditing(true)} className="btn-edit">
                      {i18n.t('profile.edit')}
                    </button>
                  </div>
                )}
              </div>

              <div className="profile-field">
                <label className="field-label">
                  <span className="field-icon">📆</span>
                  {i18n.t('profile.joined')}
                </label>
                <div className="field-display">
                  <span className="field-value">{joinDate}</span>
                </div>
              </div>

              <div className="profile-field">
                <label className="field-label">
                  <span className="field-icon">🆔</span>
                  {i18n.t('profile.username')}
                </label>
                <div className="field-display">
                  <span className="field-value">{username}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
};
