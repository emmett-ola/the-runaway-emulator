import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Settings } from '../features/settings';
import { exportUserData, importUserData } from '../lib/data/transfer';
import { i18n } from '../lib/i18n';
import { readRecord, writeRecord } from '../lib/storage';

const hit = (id: string, at = 1760000000000) => ({ id, at });
beforeEach(() => {
  localStorage.clear();
  sessionStorage.setItem('runawaylog-username', 'current');
  i18n.setLanguage('en_us');
  writeRecord({ username: 'current', hits: [hit('old')], registeredAt: 100, profile: { email: 'kept@example.com' }, settings: { games: { cardDropEnabled: true } } });
  vi.spyOn(window, 'alert').mockImplementation(() => {});
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });
async function openImport(hits = [hit('new')]) {
  const view = render(<MemoryRouter><Settings /></MemoryRouter>);
  const file = new File([JSON.stringify({ username: 'other', hits, settings: { theme: 'foreign', timezone: 'UTC' } })], 'restore.json', { type: 'application/json' });
  fireEvent.change(view.container.querySelector('input[type="file"]')!, { target: { files: [file] } });
  await waitFor(() => expect(view.getByText(i18n.t('import_dialog.title'))).toBeInTheDocument());
  return view;
}
describe('settings data-management invariants', () => {
  it('never writes on file selection or cancel; replace requires explicit destructive confirmation', async () => {
    const view = await openImport();
    expect(readRecord('current')!.hits.map(h => h.id)).toEqual(['old']);
    const replace = view.getByRole('button', { name: i18n.t('import_dialog.replace_button') });
    expect(replace).toBeDisabled();
    fireEvent.click(replace);
    expect(readRecord('current')!.hits.map(h => h.id)).toEqual(['old']);
    fireEvent.click(view.getByRole('checkbox', { name: i18n.t('import_dialog.replace') }));
    fireEvent.click(replace);
    await waitFor(() => expect(readRecord('current')!.hits.map(h => h.id)).toEqual(['new']));
    expect(readRecord('current')).toMatchObject({ username: 'current', registeredAt: 100, profile: { email: 'kept@example.com' }, settings: { games: { cardDropEnabled: true } } });
    expect(readRecord('other')).toBeNull();
    expect(localStorage.getItem('calendar-theme')).toBeNull();
  });
  it('merge deduplicates existing and incoming ids without changing identity or other user data', async () => {
    const view = await openImport([hit('old'), hit('new'), hit('new')]);
    fireEvent.click(view.getByRole('button', { name: i18n.t('import_dialog.merge_button') }));
    await waitFor(() => expect(readRecord('current')!.hits.map(h => h.id)).toEqual(['old', 'new']));
    expect(readRecord('current')!.profile!.email).toBe('kept@example.com');
  });
  it('cancel preserves bytes and language switching keeps the open import without losing hits', async () => {
    const view = await openImport();
    const before = localStorage.getItem('runawaylog-data');
    act(() => i18n.setLanguage('zh_tw'));
    expect(view.getByText(i18n.t('import_dialog.title'))).toBeInTheDocument();
    fireEvent.click(view.getByRole('button', { name: i18n.t('import_dialog.cancel_button') }));
    expect(localStorage.getItem('runawaylog-data')).toBe(before);
  });
  it('round-trips exported timestamps and ids while retaining game settings', async () => {
    let blob: Blob | undefined;
    vi.stubGlobal('URL', { createObjectURL: vi.fn((value: Blob) => { blob = value; return 'blob:test'; }), revokeObjectURL: vi.fn() });
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    exportUserData(readRecord('current')!);
    const parsed = await importUserData(new File([blob!], 'roundtrip.json'));
    expect(parsed.hits).toEqual([hit('old')]);
    expect(parsed.settings?.games).toEqual({ cardDropEnabled: true });
    vi.unstubAllGlobals();
  });
  it.each([null, { username: 'x', hits: [null] }, { username: 'x', hits: [{ id: 'a', timestamp: 'bad', date: '2025-01-01' }] }])('rejects malformed imports before any write: %j', async input => {
    await expect(importUserData(new File([JSON.stringify(input)], 'bad.json'))).rejects.toThrow();
    expect(readRecord('current')!.hits).toEqual([hit('old')]);
  });
});
