import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { Login } from './Login';
import { initializeStorage, readRecord, readStore, resetStorage } from '../lib/storage';
import { i18n } from '../lib/i18n';

vi.mock('animejs', () => ({ animate: vi.fn() }));
beforeEach(async () => { localStorage.clear(); await i18n.setLanguage('en_us'); });
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });
it('offers a downloadable original-byte rescue when a malformed store blocks login', async () => {
  // Obsolete browser bytes are not the v2 authority and must neither block nor be rewritten.
  const raw = '{unreadable original user file';
  localStorage.setItem('runawaylog-data', raw);
  await resetStorage();
  await initializeStorage();
  expect(await readStore()).toEqual({ schemaVersion: 2, users: {} });
  const onLogin = vi.fn();
  const createObjectURL = vi.fn();
  vi.stubGlobal('URL', { createObjectURL, revokeObjectURL: vi.fn() });
  render(<Login onLogin={onLogin} />);
  fireEvent.change(screen.getByLabelText(i18n.t('login.username')), { target: { value: 'existing' } });
  fireEvent.click(screen.getByRole('button', { name: i18n.t('login.button') }));
  await waitFor(() => expect(onLogin).toHaveBeenCalledOnce());
  expect(await readRecord('existing')).toMatchObject({ username: 'existing', total: 0 });
  expect(screen.queryByRole('button', { name: i18n.t('settings.export_data') })).toBeNull();
  expect(createObjectURL).not.toHaveBeenCalled();
  expect(localStorage.getItem('runawaylog-data')).toBe(raw);
  expect(localStorage.getItem('runawaylog-data-backups')).toBeNull();
});
