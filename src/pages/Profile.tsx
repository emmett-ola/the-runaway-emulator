import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Layout } from '../components/Layout';
import { loadUserData, saveUserData } from '../storage';
import { getGravatarUrl, formatMemberSince } from '../utils/gravatar';
import type { UserData } from '../types';
import { i18n } from '../i18n/i18n';
import './Profile.css';

export const Profile = () => {
  const navigate = useNavigate();
  const username = sessionStorage.getItem('runawaylog-username') || '';
  const [userData, setUserData] = useState<UserData | null>(null);
  const [email, setEmail] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [fallbackRegistrationDate] = useState(() => Date.now());
  
  const handleLogout = () => {
    sessionStorage.removeItem('runawaylog-username');
    navigate('/');
    window.location.reload();
  };

  useEffect(() => {
    const fetchUserData = async () => {
      let data = await loadUserData(username);
      if (!data) {
        // Create default user data for new users
        data = {
          username,
          hits: [],
          profile: {
            registrationDate: Date.now(),
          },
        };
        await saveUserData(data);
      }
      setUserData(data);
      setEmail(data.profile?.email || '');
    };
    
    fetchUserData();
  }, [username]);

  const handleSaveEmail = async () => {
    if (userData) {
      const updatedData: UserData = {
        ...userData,
        profile: {
          ...userData.profile,
          email: email.trim() || undefined,
          registrationDate: userData.profile?.registrationDate || Date.now(),
        },
      };
      await saveUserData(updatedData);
      setUserData(updatedData);
      setIsEditing(false);
    }
  };

  if (!userData) {
    return (
      <Layout username={username} onLogout={handleLogout}>
        <div className="profile-loading">Loading...</div>
      </Layout>
    );
  }

  const avatarUrl = getGravatarUrl(userData.profile?.email, 200, username);
  const registrationDate = userData.profile?.registrationDate || fallbackRegistrationDate;
  const memberSince = formatMemberSince(registrationDate);
  const joinDate = new Date(registrationDate).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return (
    <Layout username={username} onLogout={handleLogout}>
      <div className="profile-page">
        <div className="profile-container">
          <h1 className="profile-title">👤 {i18n.t('profile.title')}</h1>

          <div className="profile-card">
            <div className="profile-header">
              <div className="profile-avatar-section">
                <img 
                  src={avatarUrl} 
                  alt={`${username}'s avatar`}
                  className="profile-avatar"
                />
              </div>

              <div className="profile-info">
                <h2 className="profile-username">{username}</h2>
                <div className="profile-stats">
                  <div className="profile-stat">
                    <span className="stat-icon">🏃</span>
                    <span className="stat-value">{userData.hits.length}</span>
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
                      <button onClick={handleSaveEmail} className="btn-save">
                        Save
                      </button>
                      <button 
                        onClick={() => {
                          setEmail(userData.profile?.email || '');
                          setIsEditing(false);
                        }} 
                        className="btn-cancel"
                      >
                        Cancel
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
