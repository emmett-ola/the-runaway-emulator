import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, waitFor } from '@testing-library/react';
import { Dashboard } from '../features/run';
import { i18n } from '../lib/i18n';
import { ensureRunView, readFullRecord, readPreferences } from '../lib/storage';
import { getSavedTimezone } from '../lib/time';
import { seedRecord } from './storage-fixtures';
vi.mock('animejs', () => ({ animate: vi.fn(), stagger: vi.fn(() => 0) }));
const hit = (id: string) => ({ id, at: 1760000000000 });
beforeEach(async () => {
  localStorage.clear(); await i18n.setLanguage('en_us');
  await seedRecord({ username: 'current', hits: [hit('old')], registeredAt: 100, profile: { email: 'kept@example.com' }, settings: { games: { cardDropEnabled: true } } });
  await ensureRunView('current', getSavedTimezone(), new Date());
  vi.spyOn(window, 'alert').mockImplementation(() => {});
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });
it('header import obeys confirmation and preserves profile, games, identity, and device preferences', async () => {
  const preferences = await readPreferences();
  const view = render(<Dashboard username="current" onLogout={vi.fn()} />);
  await waitFor(() => expect(view.container.querySelector('.hit-count strong')).toHaveTextContent('1'), { timeout: 5000 });
  // Keep the original legacy-positive selection as explicit unsupported-format conflict evidence.
  fireEvent.change(view.container.querySelector('input[type="file"]')!, { target: { files: [new File([JSON.stringify({ username: 'other', hits: [hit('new')], settings: { timezone: 'UTC', theme: 'foreign' } })], 'restore.json')] } });
  const replace = await waitFor(() => {
    expect(window.alert).not.toHaveBeenCalled();
    return view.getByRole('button', { name: i18n.t('import_dialog.replace_button') });
  });
  expect(replace).toBeDisabled();
  fireEvent.click(view.getByRole('checkbox', { name: i18n.t('import_dialog.replace') }));
  fireEvent.click(replace);
  await waitFor(async () => expect((await readFullRecord('current')).hits.map(h => h.id)).toEqual(['new']));
  expect(await readFullRecord('current')).toMatchObject({ username: 'current', registeredAt: 100, profile: { email: 'kept@example.com' }, settings: { games: { cardDropEnabled: true } } });
  expect(await readPreferences()).toEqual(preferences);
  expect(localStorage.getItem('calendar-theme')).toBeNull();
});
