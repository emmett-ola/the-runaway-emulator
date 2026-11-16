import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Settings } from '../features/settings';
import { exportUserData, importUserData } from '../lib/data/transfer';
import { i18n } from '../lib/i18n';
import { getStorageState, readFullRecord, readPreferences, readRecord } from '../lib/storage';
import { writeIdentityCache } from '../lib/storage/preferences';
import { seedRecord } from './storage-fixtures';

const hit = (id: string, at = 1760000000000) => ({ id, at });
beforeEach(async () => {
  localStorage.clear();
  sessionStorage.clear();
  writeIdentityCache('username', 'current');
  await i18n.setLanguage('en_us');
  await seedRecord({ username: 'current', hits: [hit('old')], registeredAt: 100, profile: { email: 'kept@example.com' }, settings: { games: { cardDropEnabled: true } } });
  vi.spyOn(window, 'alert').mockImplementation(() => {});
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });
async function openImport(hits = [hit('new')]) {
  const view = render(<MemoryRouter><Settings /></MemoryRouter>);
  // Retained legacy-positive fixture: JSON acceptance is an explicit cutover conflict, not a fake ZIP.
  const file = new File([JSON.stringify({ username: 'other', hits, settings: { theme: 'foreign', timezone: 'UTC' } })], 'restore.json', { type: 'application/json' });
  fireEvent.change(view.container.querySelector('input[type="file"]')!, { target: { files: [file] } });
  await waitFor(() => {
    expect(window.alert).not.toHaveBeenCalled();
    expect(view.getByText(i18n.t('import_dialog.title'))).toBeInTheDocument();
  });
  return view;
}
describe('settings data-management invariants', () => {
  it('never writes on file selection or cancel; replace requires explicit destructive confirmation', async () => {
    const preferences = await readPreferences();
    const view = await openImport();
    expect((await readFullRecord('current')).hits.map(h => h.id)).toEqual(['old']);
    const replace = view.getByRole('button', { name: i18n.t('import_dialog.replace_button') });
    expect(replace).toBeDisabled();
    fireEvent.click(replace);
    expect((await readFullRecord('current')).hits.map(h => h.id)).toEqual(['old']);
    fireEvent.click(view.getByRole('checkbox', { name: i18n.t('import_dialog.replace') }));
    fireEvent.click(replace);
    await waitFor(async () => expect((await readFullRecord('current')).hits.map(h => h.id)).toEqual(['new']));
    expect(await readFullRecord('current')).toMatchObject({ username: 'current', registeredAt: 100, profile: { email: 'kept@example.com' }, settings: { games: { cardDropEnabled: true } } });
    expect(await readRecord('other')).toBeNull();
    expect(await readPreferences()).toEqual(preferences);
    expect(localStorage.getItem('calendar-theme')).toBeNull();
  });
  it('merge deduplicates existing and incoming ids without changing identity or other user data', async () => {
    const view = await openImport([hit('old'), hit('new'), hit('new')]);
    fireEvent.click(view.getByRole('button', { name: i18n.t('import_dialog.merge_button') }));
    await waitFor(async () => expect((await readFullRecord('current')).hits.map(h => h.id)).toEqual(['old', 'new']));
    expect((await readRecord('current'))!.profile!.email).toBe('kept@example.com');
  });
  it('cancel preserves bytes and language switching keeps the open import without losing hits', async () => {
    const view = await openImport();
    const before = await readFullRecord('current');
    await act(async () => { await i18n.setLanguage('zh_tw'); });
    expect(view.getByText(i18n.t('import_dialog.title'))).toBeInTheDocument();
    const revision = getStorageState().revision;
    fireEvent.click(view.getByRole('button', { name: i18n.t('import_dialog.cancel_button') }));
    expect(await readFullRecord('current')).toEqual(before);
    expect(getStorageState().revision).toBe(revision);
  });
  it('round-trips exported timestamps and ids while retaining game settings', async () => {
    let blob: Blob | undefined;
    vi.stubGlobal('URL', { createObjectURL: vi.fn((value: Blob) => { blob = value; return 'blob:test'; }), revokeObjectURL: vi.fn() });
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    await exportUserData('current');
    expect(blob).toBeDefined();
    expect(blob!.type).toBe('application/zip');
    const parsed = await importUserData(new File([blob!], 'roundtrip.zip', { type: 'application/zip' }));
    expect(parsed.hits).toEqual([hit('old')]);
    expect(parsed.settings?.games).toEqual({ cardDropEnabled: true });
  });
  it.each([null, { username: 'x', hits: [null] }, { username: 'x', hits: [{ id: 'a', timestamp: 'bad', date: '2025-01-01' }] }])('rejects malformed imports before any write: %j', async input => {
    const before = await readFullRecord('current');
    const revision = getStorageState().revision;
    await expect(importUserData(new File([JSON.stringify(input)], 'bad.json'))).rejects.toThrow();
    expect((await readFullRecord('current')).hits).toEqual([hit('old')]);
    expect(await readFullRecord('current')).toEqual(before);
    expect(getStorageState().revision).toBe(revision);
  });
});
