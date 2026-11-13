import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Layout } from '../../ui/Layout';
import { colorThemes, getThemeById, applyTheme } from '../../themes';
import { getTheme, setTheme, type Theme } from '../../darkMode';
import { getTimezones, getSavedTimezone, saveTimezone, getTimezoneDisplayName } from '../../lib/time';
import { i18n } from '../../lib/i18n';
import type { SupportedLanguage } from '../../lib/i18n';
import { getStorageMode, setStorageMode, type StorageMode, loadUserData } from '../../storage';
import { exportUserData, importUserData, confirmImportedData, type ImportedUserData } from '../../lib/data/transfer';
import { getCalendarTheme, setCalendarTheme } from '../../lib/storage/preferences';
import { PrintCalendar } from '../print';
import type { HitLog } from '../../types';
import '../../ui/SettingsLayout.css';

export const Settings = () => {
  const navigate = useNavigate();
  const username = sessionStorage.getItem('runawaylog-username') || '';
  
  const handleLogout = () => {
    sessionStorage.removeItem('runawaylog-username');
    navigate('/');
    window.location.reload();
  };
  
  // Theme settings
  const [selectedTheme, setSelectedTheme] = useState<string>(() => {
    return getCalendarTheme();
  });
  
  // Dark mode settings
  const [darkMode, setDarkMode] = useState<Theme>(() => getTheme());
  
  // Timezone settings
  const [selectedTimezone, setSelectedTimezone] = useState<string>(() => getSavedTimezone());
  const timezones = getTimezones();
  
  // Language settings
  const [selectedLanguage, setSelectedLanguage] = useState<SupportedLanguage>(() => i18n.getLanguage());
  
  // Storage mode settings
  const [selectedStorageMode, setSelectedStorageMode] = useState<StorageMode>(() => getStorageMode());
  
  // Import/Export settings
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importDialog, setImportDialog] = useState<{ show: boolean; data: ImportedUserData | null }>({ show: false, data: null });
  
  const [printDialog, setPrintDialog] = useState<{ hits: HitLog[]; month: Date } | null>(null);

  const [replaceConfirmed, setReplaceConfirmed] = useState(false);

  // Force re-render when language changes
  const [, setLanguageChangeTrigger] = useState(0);
  
  // Handle export data
  const handleExport = async () => {
    const userData = await loadUserData(username);
    if (userData) {
      exportUserData(userData);
    }
  };
  
  // Handle import click
  const handleImportClick = () => {
    fileInputRef.current?.click();
  };
  
  // Handle import file
  const handleImportFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    
    try {
      const importedData = await importUserData(file, username);
      setReplaceConfirmed(false);
      setImportDialog({ show: true, data: importedData });
    } catch (error) {
      alert(i18n.t('errors.import_failed', { error: error instanceof Error ? error.message : 'Unknown error' }));
    }
    
    if (event.target) {
      event.target.value = '';
    }
  };
  
  // Handle import merge
  const handleImportMerge = async () => {
    if (!importDialog.data) return;
    
    try {
      const userData = await loadUserData(username);
      const mergedData = confirmImportedData(username, importDialog.data, 'merge');
      const newHitCount = mergedData.hits.length - (userData?.hits.length ?? 0);
      setImportDialog({ show: false, data: null });
      alert(i18n.t('errors.import_merged', { count: newHitCount }));
      window.location.reload();
    } catch (error) {
      alert(i18n.t('errors.import_failed', { error: error instanceof Error ? error.message : 'Unknown error' }));
    }
  };
  
  // Handle import replace
  const handleImportReplace = async () => {
    if (!importDialog.data || !replaceConfirmed) return;
    
    try {
      confirmImportedData(username, importDialog.data, 'replace');
      setImportDialog({ show: false, data: null });
      alert(i18n.t('errors.import_replaced', { count: importDialog.data.hits.length }));
      window.location.reload();
    } catch (error) {
      alert(i18n.t('errors.import_failed', { error: error instanceof Error ? error.message : 'Unknown error' }));
    }
  };
  
  // Handle import cancel
  const handleImportCancel = () => {
    setImportDialog({ show: false, data: null });
  };
  
  // Handle print calendar
  const handlePrint = async () => {
    const month = new Date();
    let hits: HitLog[] = [];
    try {
      const userData = await loadUserData(username);
      hits = userData?.hits || [];
    } catch {
      // A failed load still opens an empty calendar.
    }
    setPrintDialog({ hits, month });
  };
  
  useEffect(() => {
    const unsubscribe = i18n.onLanguageChange(() => {
      setLanguageChangeTrigger(prev => prev + 1);
    });
    
    return () => unsubscribe();
  }, []);
  
  const handleStorageModeChange = (mode: StorageMode) => {
    if (mode !== 'local') return;
    setSelectedStorageMode(mode);
    setStorageMode(mode);
    // Refresh page to apply storage mode changes
    window.location.reload();
  };
  
  const handleThemeChange = (themeId: string) => {
    setSelectedTheme(themeId);
    setCalendarTheme(themeId);
    const theme = getThemeById(themeId);
    applyTheme(theme);
  };
  
  const handleDarkModeToggle = () => {
    const newMode = darkMode === 'light' ? 'dark' : 'light';
    setDarkMode(newMode);
    setTheme(newMode);
  };
  
  const handleTimezoneChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newTimezone = e.target.value;
    setSelectedTimezone(newTimezone);
    saveTimezone(newTimezone);
    // Refresh page to apply timezone changes
    window.location.reload();
  };
  
  const handleLanguageChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newLanguage = e.target.value as SupportedLanguage;
    setSelectedLanguage(newLanguage);
    i18n.setLanguage(newLanguage);
  };
  
  
  return (
    <Layout username={username} onLogout={handleLogout}>
      <div className="settings-page">
        <div className="settings-container">
          <h1 className="settings-title">{i18n.t('settings.title')}</h1>
          
          <div className="settings-grid">
            {/* Appearance Settings */}
            <div className="settings-card">
              <h2 className="settings-card-title">{i18n.t('settings.appearance_settings')}</h2>
              
              {/* Dark Mode */}
              <div className="setting-item">
                <div className="setting-label">{i18n.t('settings.dark_mode')}</div>
                <div className="dark-mode-toggle-container">
                  <label className="dark-mode-toggle-label">
                    <input
                      type="checkbox"
                      aria-label={i18n.t('settings.dark_mode')}
                      checked={darkMode === 'dark'}
                      onChange={handleDarkModeToggle}
                      className="dark-mode-toggle-checkbox"
                    />
                    <span className="dark-mode-toggle-slider"></span>
                  </label>
                  <span className="dark-mode-text">
                    {darkMode === 'dark' ? i18n.t('settings.dark') : i18n.t('settings.light')}
                  </span>
                </div>
              </div>
              
              {/* Theme */}
              <div className="setting-item">
                <div className="setting-label">{i18n.t('settings.theme')}</div>
                <div className="theme-grid">
                  {colorThemes.map((theme) => (
                    <div
                      key={theme.id}
                      className={`theme-option ${selectedTheme === theme.id ? 'active' : ''}`}
                      onClick={() => handleThemeChange(theme.id)}
                      style={{ 
                        background: `linear-gradient(135deg, ${theme.colors.intensity2} 0%, ${theme.colors.intensity4} 100%)` 
                      }}
                      title={theme.name}
                    />
                  ))}
                </div>
              </div>
            </div>
            
            {/* Regional Settings */}
            <div className="settings-card">
              <h2 className="settings-card-title">{i18n.t('settings.regional_settings')}</h2>
              
              {/* Timezone */}
              <div className="setting-item">
                <div className="setting-label">{i18n.t('settings.timezone')}</div>
                <select
                  aria-label={i18n.t('settings.timezone')}
                  value={selectedTimezone}
                  onChange={handleTimezoneChange}
                  className="settings-select"
                >
                  {timezones.map((timezone) => (
                    <option key={timezone}
                      value={timezone}>
                      {getTimezoneDisplayName(timezone)}
                    </option>
                  ))}
                </select>
              </div>
              
              {/* Language */}
              <div className="setting-item">
                <div className="setting-label">{i18n.t('settings.language')}</div>
                <select
                  aria-label={i18n.t('settings.language')}
                  value={selectedLanguage}
                  onChange={handleLanguageChange}
                  className="settings-select"
                >
                  {i18n.getSupportedLanguages().map((lang) => (
                    <option key={lang.code} value={lang.code}>
                      {lang.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            
            {/* Data Management */}
            <div className="settings-card">
              <h2 className="settings-card-title">{i18n.t('settings.data_management')}</h2>
              
              {/* Import/Export Buttons */}
              <div className="setting-item">
                <div className="setting-label">{i18n.t('settings.import_export')}</div>
                <div className="import-export-buttons">
                  <button onClick={handleExport} className="settings-button primary">
                    {i18n.t('settings.export_data')}
                  </button>
                  <button onClick={handleImportClick} className="settings-button secondary">
                    {i18n.t('settings.import_data')}
                  </button>
                  <button onClick={handlePrint} className="settings-button secondary">
                    {i18n.t('settings.print_calendar')}
                  </button>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".json"
                  onChange={handleImportFile}
                  style={{ display: 'none' }}
                />
              </div>
              
              {/* Storage Mode */}
              <div className="setting-item">
                <div className="setting-label">{i18n.t('storage.title')}</div>
                <div className="storage-mode-options">
                  <label 
                    className={`storage-mode-option ${selectedStorageMode === 'local' ? 'active' : ''}`}
                    onClick={() => handleStorageModeChange('local')}
                  >
                    <input 
                      type="radio" 
                      name="storage-mode" 
                      value="local" 
                      checked={selectedStorageMode === 'local'}
                      onChange={() => handleStorageModeChange('local')}
                      className="storage-mode-radio"
                    />
                    <div className="storage-mode-content">
                      <div className="storage-mode-name">📁 {i18n.t('settings.local_storage')}</div>
                      <div className="storage-mode-description">{i18n.t('settings.local_storage_description')}</div>
                    </div>
                  </label>
                  
                  <label 
                    className={`storage-mode-option ${selectedStorageMode === 'cloud' ? 'active' : ''} storage-mode-option-disabled`}
                    onClick={() => {}}
                  >
                    <input 
                      type="radio" 
                      name="storage-mode" 
                      value="cloud" 
                      checked={selectedStorageMode === 'cloud'}
                      onChange={() => {}}
                      className="storage-mode-radio"
                      disabled={true}
                    />
                    <div className="storage-mode-content">
                      <div className="storage-mode-name">☁️ {i18n.t('settings.cloud_storage')}</div>
                      <div className="storage-mode-description">{i18n.t('settings.cloud_storage_description_disabled')}</div>
                    </div>
                  </label>
                </div>
              </div>
            </div>
            
            {/* Import Dialog */}
            {importDialog.show && importDialog.data && (
              <div className="import-dialog-overlay">
                <div className="import-dialog" role="dialog" aria-modal="true" aria-label={i18n.t('import_dialog.title')}>
                  <h3 className="import-dialog-title">{i18n.t('import_dialog.title')}</h3>
                  <div className="import-dialog-content">
                    <p>
                      <strong>{i18n.t('import_dialog.from')}</strong> {importDialog.data.username}<br />
                      <strong>{i18n.t('import_dialog.escape_dreams')}</strong> {importDialog.data.hits.length}
                    </p>
                    {importDialog.data.username !== username && (
                      <div className="import-dialog-warning">
                        <div dangerouslySetInnerHTML={{ 
                          __html: i18n.t('import_dialog.warning', { 
                            username: importDialog.data.username, 
                            currentUsername: username 
                          }) 
                        }} />
                      </div>
                    )}
                    <p>
                      <strong>{i18n.t('import_dialog.merge')}</strong><br />
                      <strong>{i18n.t('import_dialog.replace')}</strong>
                    </p>
                  </div>
                  <label className="import-replace-confirmation">
                    <input type="checkbox" checked={replaceConfirmed} onChange={event => setReplaceConfirmed(event.target.checked)} />
                    {i18n.t('import_dialog.replace')}
                  </label>
                  <div className="import-dialog-actions">
                    <button onClick={handleImportMerge} className="settings-button primary">
                      {i18n.t('import_dialog.merge_button')}
                    </button>
                    <button onClick={handleImportReplace} disabled={!replaceConfirmed} className="settings-button danger">
                      {i18n.t('import_dialog.replace_button')}
                    </button>
                    <button onClick={handleImportCancel} className="settings-button secondary">
                      {i18n.t('import_dialog.cancel_button')}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
      {printDialog && (
        <PrintCalendar
          hits={printDialog.hits}
          username={username}
          currentMonth={printDialog.month}
          timezone={selectedTimezone}
          onClose={() => setPrintDialog(null)}
        />
      )}
    </Layout>
  );
};