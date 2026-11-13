import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { Login } from './Login';
import { i18n } from '../lib/i18n';

vi.mock('animejs', () => ({ animate: vi.fn() }));
beforeEach(() => { localStorage.clear(); i18n.setLanguage('en_us'); });
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });
it('offers a downloadable original-byte rescue when a malformed store blocks login', async () => {
  const raw = '{unreadable original user file';
  localStorage.setItem('runawaylog-data', raw);
  vi.spyOn(console, 'error').mockImplementation(() => {});
  const onLogin = vi.fn();
  let blob: Blob | undefined;
  vi.stubGlobal('URL', { createObjectURL: vi.fn((value: Blob) => { blob = value; return 'blob:rescue'; }), revokeObjectURL: vi.fn() });
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
  render(<Login onLogin={onLogin} />);
  fireEvent.change(screen.getByLabelText(i18n.t('login.username')), { target: { value: 'existing' } });
  fireEvent.click(screen.getByRole('button', { name: i18n.t('login.button') }));
  await waitFor(() => expect(screen.getByRole('button', { name: i18n.t('settings.export_data') })).toBeInTheDocument());
  expect(onLogin).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: i18n.t('settings.export_data') }));
  const text = await new Promise<string>(resolve => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.readAsText(blob!);
  });
  expect(JSON.parse(text).unknown.backup).toBe(raw);
  expect(localStorage.getItem('runawaylog-data')).toBe(raw);
});
