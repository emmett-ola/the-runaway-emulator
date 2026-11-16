import { useState, useEffect, useRef } from 'react';
import { colorThemes, getThemeById, applyTheme } from '../../themes';
import { getTheme, setTheme, type Theme } from '../../darkMode';
import { getTimezones, getSavedTimezone, saveTimezone, getTimezoneDisplayName } from '../../lib/time';
import { i18n, type SupportedLanguage } from '../../lib/i18n';
import { getCalendarTheme, setCalendarTheme, subscribePreferences } from '../../lib/storage';
import './SettingsMenu.css';

interface SettingsMenuProps {
  onExport: () => void | Promise<void>;
  onImport: () => void | Promise<void>;
  onPrint: () => void | Promise<void>;
  onTimezoneChange?: () => void;
}

export const SettingsMenu = ({ onExport, onImport, onPrint, onTimezoneChange }: SettingsMenuProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedTheme, setSelectedTheme] = useState<string>(getCalendarTheme);
  const [darkMode, setDarkMode] = useState<Theme>(() => getTheme());
  const [selectedTimezone, setSelectedTimezone] = useState<string>(() => getSavedTimezone());
  const [selectedLanguage, setSelectedLanguage] = useState<SupportedLanguage>(() => i18n.getLanguage());
  const menuRef = useRef<HTMLDivElement>(null);
  const pending = useRef(false);
  const [error, setError] = useState('');
  const timezones = getTimezones();
  
  // Handle language change
  useEffect(() => {
    return i18n.onLanguageChange(() => {
      setSelectedLanguage(i18n.getLanguage());
    });
  }, []);
  
  const handleLanguageChange = (language: SupportedLanguage) => {
    void savePreference(() => i18n.setLanguage(language), () => setSelectedLanguage(language));
  };

  useEffect(() => subscribePreferences(() => {
    setSelectedTheme(getCalendarTheme());
    setDarkMode(getTheme());
    setSelectedTimezone(getSavedTimezone());
    setSelectedLanguage(i18n.getLanguage());
  }), []);

  useEffect(() => {
    const theme = getThemeById(selectedTheme);
    applyTheme(theme);
  }, [selectedTheme]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleEscape);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen]);

  const savePreference = async (command: () => Promise<unknown>, onSaved: () => void) => {
    if (pending.current) return;
    pending.current = true;
    setError('');
    try { await command(); onSaved(); }
    catch { setError(i18n.t('errors.storage_failed')); }
    finally { pending.current = false; }
  };

  const handleThemeChange = (themeId: string) => {
    void savePreference(() => setCalendarTheme(themeId), () => setSelectedTheme(themeId));
  };

  const handleDarkModeToggle = () => {
    const newTheme = darkMode === 'light' ? 'dark' : 'light';
    void savePreference(() => setTheme(newTheme), () => setDarkMode(newTheme));
  };

  const handleTimezoneChange = (timezone: string) => {
    void savePreference(() => saveTimezone(timezone), () => {
      setSelectedTimezone(timezone);
      onTimezoneChange?.();
    });
  };

  const handleMenuAction = async (action: () => void | Promise<void>) => {
    try { await action(); setIsOpen(false); }
    catch { setError(i18n.t('errors.storage_failed')); }
  };

  return (
    <div className="settings-menu-container" ref={menuRef}>
      {error && <p role="alert">{error}</p>}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="settings-button"
        title={i18n.t('settings_menu.title')}
        aria-label={i18n.t('settings_menu.title')}
      >
        {i18n.t('dashboard.settings')}
      </button>

      {isOpen && (
        <div className="settings-dropdown">
          <div className="settings-section">
            <h3 className="settings-section-title">{i18n.t('settings_menu.appearance')}</h3>
            <button onClick={handleDarkModeToggle} className="dark-mode-toggle">
              <span className="toggle-icon">{darkMode === 'dark' ? '🌙' : '☀️'}</span>
              <span className="toggle-label">
                {darkMode === 'dark' ? i18n.t('settings_menu.dark_mode') : i18n.t('settings_menu.light_mode')}
              </span>
              <div className={`toggle-switch ${darkMode === 'dark' ? 'active' : ''}`}>
                <div className="toggle-slider"></div>
              </div>
            </button>
          </div>

          <div className="settings-divider"></div>

          <div className="settings-section">
            <h3 className="settings-section-title">{i18n.t('settings_menu.calendar_theme')}</h3>
            <div className="theme-selector">
              <select 
                value={selectedTheme} 
                onChange={(e) => handleThemeChange(e.target.value)}
                className="theme-select"
              >
                {colorThemes.map((theme) => (
                  <option key={theme.id} value={theme.id}>
                    {theme.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="settings-divider"></div>

          <div className="settings-section">
            <h3 className="settings-section-title">{i18n.t('settings_menu.timezone')}</h3>
            <div className="timezone-selector">
              <select 
                value={selectedTimezone} 
                onChange={(e) => handleTimezoneChange(e.target.value)}
                className="timezone-select"
              >
                {timezones.map((tz) => (
                  <option key={tz} value={tz}>
                    {getTimezoneDisplayName(tz)}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="settings-divider"></div>

          <div className="settings-section">
            <h3 className="settings-section-title">{i18n.t('settings_menu.language')}</h3>
            <div className="language-selector">
              <select 
                value={selectedLanguage} 
                onChange={(e) => handleLanguageChange(e.target.value as SupportedLanguage)}
                className="timezone-select"
              >
                {i18n.getSupportedLanguages().map((lang) => (
                  <option key={lang.code} value={lang.code}>
                    {lang.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="settings-divider"></div>

          <div className="settings-section">
            <h3 className="settings-section-title">{i18n.t('settings_menu.actions')}</h3>
            <button onClick={() => handleMenuAction(onExport)} className="settings-action-btn">
              <span className="action-icon">📥</span>
              <span>{i18n.t('settings_menu.export_data')}</span>
            </button>
            <button onClick={() => handleMenuAction(onImport)} className="settings-action-btn">
              <span className="action-icon">📤</span>
              <span>{i18n.t('settings_menu.import_data')}</span>
            </button>
            <button onClick={() => handleMenuAction(onPrint)} className="settings-action-btn">
              <span className="action-icon">🖨️</span>
              <span>{i18n.t('settings_menu.print_calendar')}</span>
            </button>
            <button onClick={() => setIsOpen(false)} className="settings-action-btn">
              <span className="action-icon">✖️</span>
              <span>{i18n.t('settings_menu.close')}</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
