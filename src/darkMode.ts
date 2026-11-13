import { getAppearance, setAppearance } from './lib/storage/preferences';

export type Theme = 'light' | 'dark';

export const getTheme = (): Theme => {
  const stored = getAppearance();
  if (stored === 'dark' || stored === 'light') {
    return stored;
  }
  
  // Check system preference
  if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
    return 'dark';
  }
  
  return 'light';
};

export const setTheme = (theme: Theme): void => {
  setAppearance(theme);
  applyTheme(theme);
};

export const applyTheme = (theme: Theme): void => {
  if (theme === 'dark') {
    document.documentElement.setAttribute('data-theme', 'dark');
  } else {
    document.documentElement.removeAttribute('data-theme');
  }
};

export const toggleTheme = (): Theme => {
  const current = getTheme();
  const next = current === 'light' ? 'dark' : 'light';
  setTheme(next);
  return next;
};

// Initialize theme on load
export const initTheme = (): void => {
  const theme = getTheme();
  applyTheme(theme);
};
