import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, expect, it, vi } from 'vitest';
import { Layout } from './Layout';
import { i18n } from '../lib/i18n';
afterEach(() => { cleanup(); vi.restoreAllMocks(); });
function ThrowingSurface(): never { throw new Error('real render failure'); }
it.each(['en_us', 'zh_cn', 'zh_tw'] as const)('isolates a real throwing surface and recovers by navigation in %s', locale => {
  i18n.setLanguage(locale);
  vi.spyOn(console, 'error').mockImplementation(() => {});
  render(<MemoryRouter><Routes><Route path="/" element={<Layout username="test" onLogout={() => {}}><ThrowingSurface /></Layout>} /><Route path="/games" element={<Layout username="test" onLogout={() => {}}><h1>Recovered surface</h1></Layout>} /></Routes></MemoryRouter>);
  expect(screen.getByRole('alert')).toHaveTextContent(i18n.t('surface_error.title'));
  expect(screen.getByRole('navigation')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('link', { name: i18n.t('navigation.games') }));
  expect(screen.getByRole('heading', { name: 'Recovered surface' })).toBeInTheDocument();
  expect(screen.queryByRole('alert')).toBeNull();
});
