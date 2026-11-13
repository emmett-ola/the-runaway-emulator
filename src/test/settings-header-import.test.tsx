import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, waitFor } from '@testing-library/react';
import { Dashboard } from '../features/run';
import { i18n } from '../lib/i18n';
import { readRecord, writeRecord } from '../lib/storage';
vi.mock('animejs', () => ({ animate: vi.fn(), stagger: vi.fn(() => 0) }));
const hit = (id: string) => ({ id, timestamp: 1760000000000, date: '2025-10-09' });
beforeEach(() => {
  localStorage.clear(); i18n.setLanguage('en_us');
  writeRecord({ username: 'current', hits: [hit('old')], profile: { registrationDate: 100, email: 'kept@example.com' }, settings: { games: { cardDropEnabled: true } } });
  vi.spyOn(window, 'alert').mockImplementation(() => {});
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });
it('header import obeys confirmation and preserves profile, games, identity, and device preferences', async () => {
  const view = render(<Dashboard username="current" onLogout={vi.fn()} />);
  await waitFor(() => expect(view.container.querySelector('.hit-count strong')).toHaveTextContent('1'), { timeout: 5000 });
  fireEvent.change(view.container.querySelector('input[type="file"]')!, { target: { files: [new File([JSON.stringify({ username: 'other', hits: [hit('new')], settings: { timezone: 'UTC', theme: 'foreign' } })], 'restore.json')] } });
  const replace = await view.findByRole('button', { name: i18n.t('import_dialog.replace_button') }, { timeout: 5000 });
  expect(replace).toBeDisabled();
  fireEvent.click(view.getByRole('checkbox', { name: i18n.t('import_dialog.replace') }));
  fireEvent.click(replace);
  await waitFor(() => expect(readRecord('current')!.hits.map(h => h.id)).toEqual(['new']));
  expect(readRecord('current')).toMatchObject({ username: 'current', profile: { registrationDate: 100, email: 'kept@example.com' }, settings: { games: { cardDropEnabled: true } } });
  expect(localStorage.getItem('calendar-theme')).toBeNull();
});
