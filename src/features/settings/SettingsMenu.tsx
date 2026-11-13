import { useState, useEffect, useRef } from 'react';
import { colorThemes, getThemeById, applyTheme } from '../../themes';
import { getTheme, setTheme, type Theme } from '../../darkMode';
import { getTimezones, getSavedTimezone, saveTimezone, getTimezoneDisplayName } from '../../timezone';
import { i18n, type SupportedLanguage } from '../../lib/i18n';
import { getCalendarTheme, setCalendarTheme } from '../../lib/storage/preferences';
import './SettingsMenu.css';

interface SettingsMenuProps {
  onExport: () => void;
  onImport: () => void;
  onPrint: () => void;
  onTimezoneChange?: () => void;
}

export const SettingsMenu = ({ onExport, onImport, onPrint, onTimezoneChange }: SettingsMenuProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedTheme, setSelectedTheme] = useState<string>(getCalendarTheme);
  const [darkMode, setDarkMode] = useState<Theme>(() => getTheme());
  const [selectedTimezone, setSelectedTimezone] = useState<string>(() => getSavedTimezone());
  const [selectedLanguage, setSelectedLanguage] = useState<SupportedLanguage>(() => i18n.getLanguage());
  const menuRef = useRef<HTMLDivElement>(null);
  const timezones = getTimezones();
  
  // Handle language change
  useEffect(() => {
    return i18n.onLanguageChange(() => {
      setSelectedLanguage(i18n.getLanguage());
    });
  }, []);
  
  const handleLanguageChange = (language: SupportedLanguage) => {
    setSelectedLanguage(language);
    i18n.setLanguage(language);
  };

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

  const handleThemeChange = (themeId: string) => {
    setSelectedTheme(themeId);
    setCalendarTheme(themeId);
  };

  const handleDarkModeToggle = () => {
    const newTheme = darkMode === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
    setDarkMode(newTheme);
  };

  const handleTimezoneChange = (timezone: string) => {
    setSelectedTimezone(timezone);
    saveTimezone(timezone);
    if (onTimezoneChange) {
      onTimezoneChange();
    }
  };

  const handleMenuAction = (action: () => void) => {
    action();
    setIsOpen(false);
  };

  return (
    <div className="settings-menu-container" ref={menuRef}>
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
