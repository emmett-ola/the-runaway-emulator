import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, expect, it, vi } from 'vitest';
import { AppRoutes } from './routes';
import { Layout } from '../ui/Layout';
import { i18n } from '../lib/i18n';

vi.mock('../features/run', () => ({
  Home: function ThrowingSurface(): never { throw new Error('whole route render failure'); },
}));
vi.mock('../features/games', () => ({
  GamesHub: () => <Layout username="test" onLogout={() => {}}><h1>Recovered route</h1></Layout>,
  CardGame: () => null,
}));

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

it.each(['en_us', 'zh_cn', 'zh_tw'] as const)('recovers from a whole-surface failure through outer route navigation in %s', locale => {
  i18n.setLanguage(locale);
  vi.spyOn(console, 'error').mockImplementation(() => {});
  render(<MemoryRouter><AppRoutes username="test" handleLogout={() => {}} /></MemoryRouter>);

  // Home throws before it can mount Layout, so only the outer route boundary can catch it.
  expect(screen.getByRole('alert')).toHaveTextContent(i18n.t('surface_error.title'));
  expect(screen.getByRole('button', { name: i18n.t('surface_error.retry') })).toBeInTheDocument();
  expect(screen.getByRole('navigation')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /test/ })).toBeInTheDocument();

  fireEvent.click(screen.getByRole('link', { name: i18n.t('navigation.games') }));
  expect(screen.getByRole('heading', { name: 'Recovered route' })).toBeInTheDocument();
  expect(screen.queryByRole('alert')).toBeNull();
  expect(screen.getByRole('navigation')).toBeInTheDocument();

  // Returning to the failed route must not leave the recovered route or its boundary stuck.
  fireEvent.click(screen.getByRole('link', { name: i18n.t('navigation.home') }));
  expect(screen.getByRole('alert')).toHaveTextContent(i18n.t('surface_error.title'));
  expect(screen.queryByRole('heading', { name: 'Recovered route' })).toBeNull();
  fireEvent.click(screen.getByRole('link', { name: i18n.t('navigation.games') }));
  expect(screen.getByRole('heading', { name: 'Recovered route' })).toBeInTheDocument();
  expect(screen.queryByRole('alert')).toBeNull();
});
