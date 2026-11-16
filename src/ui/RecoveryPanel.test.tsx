import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { i18n } from '../lib/i18n';
import { appendHit, createAccount, initializeStorage, resetStorage } from '../lib/storage';
import { completed, getGeneration, openDatabase, readBlob, readCurrent, transaction } from '../lib/storage/idb';
import { getStorageState } from '../lib/storage/snapshot';
import { RecoveryPanel } from './RecoveryPanel';
import { Login } from './Login';
import App from '../app/App';

vi.mock('animejs', () => ({ animate: vi.fn() }));
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });
const corrupt = async (generationId: string): Promise<void> => {
  const generation = await getGeneration(generationId), blob = await readBlob(generation.map['manifest.json']);
  const tx = transaction(await openDatabase(), 'readwrite'), done = completed(tx);
  tx.objectStore('blobs').put({ ...blob, bytes: new Uint8Array([0xff, 0x00, 0xc3]) }, blob.id);
  await done;
};
const blockedFixture = async (language: 'en_us' | 'zh_cn' | 'zh_tw' = 'en_us') => {
  await i18n.setLanguage(language);
  const id = (await createAccount('reader')).accountId!;
  await appendHit(id, { id: 'retained-hit', at: Date.UTC(2026, 10, 1), schemaVersion: 1, recordVersion: '1' });
  const older = (await readCurrent())!;
  await appendHit(id, { id: 'newer-hit', at: Date.UTC(2026, 10, 2), schemaVersion: 1, recordVersion: '1' });
  const damaged = (await readCurrent())!;
  await corrupt(damaged.generation);
  await resetStorage();
  await expect(initializeStorage()).rejects.toThrow();
  return { id, older, damaged };
};

it.each(['en_us', 'zh_cn', 'zh_tw'] as const)('labels older recovery read-only and requires explicit consent in %s', async language => {
  const { older, damaged } = await blockedFixture(language);
  const restored = vi.fn();
  render(<RecoveryPanel onRestored={restored} />);
  expect(await screen.findByRole('heading', { name: i18n.t('recovery.previous', { generation: older.generation, revision: older.revision }) })).toBeInTheDocument();
  expect(screen.getByText(i18n.t('recovery.account', { handle: 'reader', count: 1 }))).toBeInTheDocument();
  const restore = screen.getByRole('button', { name: i18n.t('recovery.restore') });
  expect(restore).toBeDisabled();
  fireEvent.click(restore);
  expect(await readCurrent()).toEqual(damaged);
  expect(restored).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('checkbox', { name: i18n.t('recovery.confirm') }));
  expect(restore).toBeEnabled();
  fireEvent.click(restore);
  await waitFor(() => expect(restored).toHaveBeenCalledOnce());
  const current = (await readCurrent())!;
  expect(current.generation).not.toBe(older.generation);
  expect(current.generation).not.toBe(damaged.generation);
  expect(BigInt(current.revision)).toBeGreaterThan(BigInt(damaged.revision));
  expect(getStorageState().status).toBe('ready');
});

it('read-only account inspection exposes exact older hit details without promotion or save controls', async () => {
  const { damaged } = await blockedFixture();
  render(<RecoveryPanel />);
  fireEvent.click(await screen.findByRole('button', { name: i18n.t('recovery.view') }));
  const details = await screen.findByLabelText(i18n.t('recovery.details'));
  expect(details).toHaveTextContent('retained-hit');
  expect(details).not.toHaveTextContent('newer-hit');
  expect(details.tagName).toBe('PRE');
  expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  expect(await readCurrent()).toEqual(damaged);
  expect(getStorageState().status).toBe('blocked');
});

it('Login renders recovery rather than allowing an empty account over damaged current', async () => {
  const { damaged } = await blockedFixture();
  const onLogin = vi.fn();
  render(<Login onLogin={onLogin} />);
  expect(await screen.findByRole('heading', { name: i18n.t('recovery.title') })).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: i18n.t('login.button') })).not.toBeInTheDocument();
  expect(screen.queryByLabelText(i18n.t('login.username'))).not.toBeInTheDocument();
  expect(onLogin).not.toHaveBeenCalled();
  expect(await readCurrent()).toEqual(damaged);
});

it('App boot failure exposes recovery and raw rescue without mounting writable routes', async () => {
  await blockedFixture();
  await resetStorage();
  render(<App />);
  expect(await screen.findByRole('heading', { name: i18n.t('recovery.title') })).toBeInTheDocument();
  expect(await screen.findByRole('button', { name: i18n.t('recovery.rescue') })).toBeEnabled();
  expect(screen.queryByRole('button', { name: i18n.t('dashboard.run_button') })).not.toBeInTheDocument();
  expect(getStorageState().status).toBe('blocked');
});

it('no healthy generation still offers actual rescue download without a restore action', async () => {
  await i18n.setLanguage('en_us');
  await createAccount('only');
  const pointer = (await readCurrent())!;
  await corrupt(pointer.generation);
  await resetStorage();
  await expect(initializeStorage()).rejects.toThrow();
  let downloaded: Blob | null = null;
  const createObjectURL = vi.fn((blob: Blob) => { downloaded = blob; return 'blob:recovery'; });
  vi.stubGlobal('URL', { createObjectURL, revokeObjectURL: vi.fn() });
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
  render(<RecoveryPanel />);
  expect(await screen.findByText(i18n.t('recovery.none'))).toBeInTheDocument();
  expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: i18n.t('recovery.restore') })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: i18n.t('recovery.rescue') }));
  await waitFor(() => expect(createObjectURL).toHaveBeenCalledOnce());
  expect(downloaded).toBeInstanceOf(Blob);
  expect(downloaded!.type).toBe('application/zip');
  expect(await readCurrent()).toEqual(pointer);
  expect(getStorageState().status).toBe('blocked');
});

it('IndexedDB unavailable explicitly says original bytes are inaccessible and disables rescue', async () => {
  await i18n.setLanguage('en_us');
  await resetStorage();
  vi.stubGlobal('indexedDB', undefined);
  await expect(initializeStorage()).rejects.toMatchObject({ code: 'unavailable' });
  render(<RecoveryPanel />);
  expect(await screen.findByText(i18n.t('recovery.inaccessible'))).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: i18n.t('recovery.rescue') })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: i18n.t('recovery.restore') })).not.toBeInTheDocument();
  await act(async () => undefined);
});
