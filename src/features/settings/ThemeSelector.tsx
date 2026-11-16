import { useState, useEffect } from 'react';
import { colorThemes, getThemeById, applyTheme, type ColorTheme } from '../../themes';
import { getCalendarTheme, setCalendarTheme, subscribePreferences } from '../../lib/storage/preferences';
import { useT } from '../../lib/i18n';
import './ThemeSelector.css';

interface ThemeSelectorProps {
  onThemeChange?: (theme: ColorTheme) => void;
}

export const ThemeSelector = ({ onThemeChange }: ThemeSelectorProps) => {
  const t = useT();
  const [selectedTheme, setSelectedTheme] = useState<string>(getCalendarTheme);
  const [error, setError] = useState('');
  useEffect(() => subscribePreferences(() => setSelectedTheme(getCalendarTheme())), []);

  useEffect(() => {
    const theme = getThemeById(selectedTheme);
    applyTheme(theme);
    if (onThemeChange) {
      onThemeChange(theme);
    }
  }, [selectedTheme, onThemeChange]);

  const handleThemeChange = async (themeId: string) => {
    try {
      await setCalendarTheme(themeId);
      setSelectedTheme(themeId);
      setError('');
    } catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)); }
  };

  return (
    <div className="theme-selector">
      {error && <p role="alert">{error}</p>}
      <label htmlFor="theme-select" className="theme-label">
        🎨 {t('settings_menu.calendar_theme')}:
      </label>
      <select
        id="theme-select"
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
  );
};
