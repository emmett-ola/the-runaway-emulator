import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { IDBObjectStore } from 'fake-indexeddb';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Dashboard } from './Dashboard';
import { SceneContext, usePageSceneClaim } from '../../lib/scene';
import { ensureRunView, flushWrites, getAccountSnapshot, readFullRecord } from '../../lib/storage';
import { seedRecord } from '../../test/storage-fixtures';
import { i18n } from '../../lib/i18n';
import { saveTimezone } from '../../lib/time';

vi.mock('animejs', () => ({ animate: vi.fn(), stagger: vi.fn(() => 0) }));

beforeEach(async () => {
  await i18n.setLanguage('en_us');
  await saveTimezone('UTC');
  vi.spyOn(Math, 'random').mockReturnValue(0.5);
  await seedRecord({ username: 'runner', hits: [], registeredAt: 1, profile: {} });
  await ensureRunView('runner', 'UTC', new Date());
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('Run durable failure boundary', () => {
  it('shows a rejected real IDB write, preserves history and the scene claim, then unlocks for one safe retry', async () => {
    const claimed = vi.fn();
    function Page() {
      const claim = usePageSceneClaim();
      return <SceneContext.Provider value={() => { claimed(); return claim(); }}>
        <Dashboard username="runner" onLogout={() => {}} showHeader={false} />
      </SceneContext.Provider>;
    }

    const { container } = render(<Page />);
    const runButton = screen.getByRole('button', { name: /RUN/ });
    await waitFor(() => expect(runButton).toBeEnabled());
    const initialCount = container.querySelector('.hit-count')?.textContent;
    const account = getAccountSnapshot('runner');
    if (!account) throw new Error('Seeded runner account missing');
    expect(account.total).toBe(0);

    // Inject a real request boundary failure; persistence and WebCrypto stay real.
    const originalAdd = IDBObjectStore.prototype.add;
    let injected = false;
    const put = vi.spyOn(IDBObjectStore.prototype, 'add').mockImplementation(function (
      this: IDBObjectStore, value: unknown, key?: IDBValidKey,
    ) {
      if (this.name === 'blobs' && !injected) {
        injected = true;
        throw new DOMException('Injected Run quota failure', 'QuotaExceededError');
      }
      return originalAdd.call(this, value, key);
    });

    fireEvent.click(runButton);
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Injected Run quota failure'));
    expect(injected).toBe(true);
    expect(getAccountSnapshot('runner')?.total).toBe(0);
    expect(container.querySelector('.hit-count')?.textContent).toBe(initialCount);
    expect(claimed).not.toHaveBeenCalled();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(runButton).toBeDisabled();

    put.mockRestore();
    await waitFor(() => expect(runButton).toBeEnabled(), { timeout: 4000 });
    expect(getAccountSnapshot('runner')?.total).toBe(0);
    expect(claimed).not.toHaveBeenCalled();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect((await readFullRecord(account.accountId)).hits).toHaveLength(0);

    // Two immediate presses still submit only one retry intent.
    act(() => { runButton.click(); runButton.click(); });
    await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument(), { timeout: 4000 });
    await act(async () => { await flushWrites(); });
    expect(getAccountSnapshot('runner')?.total).toBe(1);
    expect((await readFullRecord(account.accountId)).hits).toHaveLength(1);
    expect(container.querySelector('.hit-count')?.textContent).not.toBe(initialCount);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(claimed).toHaveBeenCalledTimes(1);
    expect(runButton).toBeEnabled();
  }, 12000);
});
