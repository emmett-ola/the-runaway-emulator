import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { act, cleanup, fireEvent, render, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Navigation } from '../ui/Navigation';
import { PrintCalendar } from '../features/print';
import { GamesHub } from '../features/games';
import { Login } from '../ui/Login';
import { Settings } from '../features/settings';
import { loadUserData } from '../storage';
import userEvent from '@testing-library/user-event';
import { i18n } from '../lib/i18n';
import type { SupportedLanguage } from '../lib/i18n';
import { collection, copy, localeTags, rarities } from './i18n-copy';
import { renderedExpectations as baseline } from './i18n-copy';

vi.mock('../storage', async importOriginal => {
  const actual = await importOriginal<typeof import('../storage')>();
  return {
    ...actual,
    loadUserData: vi.fn(async () => ({ username: 'testuser', registeredAt: 1, hits: [], settings: { games: { cardDropEnabled: true } }, cardCollections: collection })),
    saveUserData: vi.fn(async () => {}),
  };
});
vi.mock('animejs', () => ({ animate: vi.fn() }));

const locales: SupportedLanguage[] = ['en_us', 'zh_cn', 'zh_tw'];
const month = new Date(2026, 10, 1);
const today = new Date(2026, 10, 12, 12);
const close = vi.fn();
const expected = (locale: SupportedLanguage, key: string, params: Record<string, number> = {}) =>
  copy[key][locale].replace(/\{([^}]+)\}/g, (match, name: string) => params[name] === undefined ? match : String(params[name]));
const texts = (root: ParentNode, selector: string) => Array.from(root.querySelectorAll(selector), node => node.textContent?.trim());
const existing = (key: string) => {
  const value = i18n.t(key);
  expect(value).not.toBe(key);
  return value;
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(loadUserData).mockReset().mockResolvedValue({ username: 'testuser', registeredAt: 1, hits: [], settings: { games: { cardDropEnabled: true } }, cardCollections: collection });
  localStorage.clear();
  sessionStorage.clear();
  sessionStorage.setItem('runawaylog-username', 'testuser');
  i18n.setLanguage('en_us');
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(today);
});
afterEach(() => {
  cleanup();
  i18n.setLanguage('en_us');
  vi.useRealTimers();
  vi.restoreAllMocks();
});

function checkNav(root: ParentNode) {
  expect.soft(texts(root, '.user-menu-text')).toEqual([
    existing('navigation.profile'), existing('navigation.about'), existing('dashboard.logout'),
  ]);
}
function checkPrint(root: ParentNode, locale: SupportedLanguage) {
  const text = (selector: string) => root.querySelector(selector)?.textContent?.trim();
  expect.soft(text('.print-dialog-header h2')).toBe(expected(locale, 'print.dialog_title'));
  expect.soft(root.querySelector('.print-close-btn')?.getAttribute('aria-label')).toBe(expected(locale, 'print.close'));
  expect.soft(text('.print-title')).toBe(`🏃 ${existing('dashboard.brand_title')}`);
  expect.soft(text('.print-month-title')).toBe(month.toLocaleDateString(localeTags[locale], { month: 'long', year: 'numeric' }));
  expect.soft(text('.print-date')).toBe(today.toLocaleDateString(localeTags[locale], { year: 'numeric', month: 'long', day: 'numeric' }));
  expect.soft(texts(root, '.print-weekday')).toEqual(['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'].map(day => expected(locale, `print.weekday_${day}`)));
  expect.soft(texts(root, '.print-calendar-legend span')).toEqual(['less', 'more'].map(key => expected(locale, `print.legend_${key}`)));
  expect.soft(texts(root, '.print-stat-label')).toEqual(['total', 'month'].map(key => expected(locale, `print.stats_${key}`)));
  expect.soft(texts(root, '.print-stat-value')).toEqual(['0', '0']);
  expect.soft(text('.print-note')).toBe(expected(locale, 'print.tip'));
  expect.soft(texts(root, '.print-buttons button')).toEqual(['print', 'cancel'].map(key => expected(locale, `print.button_${key}`)));
  expect.soft(texts(root, '.print-day-number')).toEqual(Array.from({ length: 30 }, (_, index) => String(index + 1)));
  if (locale !== 'en_us') expect.soft(text('.print-dialog')).not.toMatch(/Print Calendar|Total Escape Dreams|This Month:|Background graphics|Cancel|\bSun\b|\bMon\b/);
}

async function album() {
  const result = render(<MemoryRouter><GamesHub /></MemoryRouter>);
  await waitFor(() => expect(result.container.querySelector('.game-card button')).toHaveStyle({ cursor: 'pointer' }));
  fireEvent.click(result.container.querySelector('.game-card button')!);
  await waitFor(() => expect(result.container.querySelectorAll('h3')).toHaveLength(11));
  const modal = result.container.querySelector('h2')!.parentElement!;
  return { ...result, modal };
}

function checkAlbum(modal: HTMLElement, locale: SupportedLanguage, page: number) {
  const ids = page === 0 ? [1, 2, 3, 4, 5, 6] : [7, 8];
  expect.soft(texts(modal, 'h3')).toEqual(ids.map(id => expected(locale, `games.card_${id}_name`)));
  expect.soft(texts(modal, 'p')).toEqual(ids.map(id => expected(locale, `games.card_${id}_desc`)));
  expect.soft(modal.children[2].textContent?.trim()).toBe(expected(locale, 'games.album_page_info', { current: page + 1, total: 2 }));
  expect.soft(texts(modal, 'button')).toEqual(['✕', expected(locale, 'games.album_prev'), expected(locale, 'games.album_next')]);
  const grid = modal.children[3];
  expect.soft(grid.children).toHaveLength(6);
  for (const [index, id] of ids.entries()) {
    const card = grid.children[index] as HTMLElement;
    const count = collection[`#${String(id).padStart(3, '0')}` as keyof typeof collection];
    expect.soft(card.children[0].textContent).toBe(`#${String(id).padStart(3, '0')}`);
    expect.soft(card.children[3].textContent?.trim()).toBe(expected(locale, `games.rarity_${rarities[id - 1]}`));
    expect.soft(card.style.opacity).toBe(count > 0 ? '1' : '0.7');
    expect.soft(card.children.length).toBe(count > 0 ? 5 : 4);
    if (count > 0) expect.soft(card.children[4].textContent?.trim()).toBe(expected(locale, 'games.album_owned_count', { count }));
  }
  if (page === 1) for (const filler of Array.from(grid.children).slice(2)) expect.soft(filler.textContent).toBe('');
  if (locale === 'en_us') expect.soft(modal.textContent).not.toMatch(/[㐀-䶿一-鿿豈-﫿]/);
  else expect.soft(modal.textContent).not.toMatch(/COMMON|UNCOMMON|RARE|LEGENDARY/);
}

describe.each(locales)('i18n rendered surfaces — %s', locale => {
  beforeEach(() => i18n.setLanguage(locale));
  it('Navigation opened menu resolves all three existing keys', () => {
    const { container } = render(<MemoryRouter><Navigation username="testuser" onLogout={close} /></MemoryRouter>);
    fireEvent.click(container.querySelector('.nav-user')!);
    checkNav(container);
  });
  it('Print dialog declares its exact modal contract and resolves the localized title id', () => {
    const { container, getByRole } = render(<PrintCalendar hits={[]} username="testuser" currentMonth={month} onClose={close} />);
    const dialog = getByRole('dialog', { name: expected(locale, 'print.dialog_title') });
    expect(dialog).toBe(container.querySelector('.print-dialog'));
    expect(dialog).toHaveAttribute('role', 'dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveAttribute('tabindex', '-1');
    const title = container.querySelector('.print-dialog-header > h2')!;
    expect(title.id).not.toBe('');
    expect(dialog).toHaveAttribute('aria-labelledby', title.id);
    expect(document.getElementById(title.id)).toBe(title);
    expect(title).toHaveTextContent(expected(locale, 'print.dialog_title'));
    expect(dialog).toHaveFocus();
    expect(document.body).toHaveClass('print-mode');
  });
  it('Settings opens the loaded current-month calendar, never the Settings print surface', async () => {
    localStorage.setItem('runawaylog-timezone', 'America/Los_Angeles');
    const timestamp = Date.UTC(2026, 11, 1, 1);
    vi.mocked(loadUserData).mockResolvedValueOnce({ username: 'testuser', registeredAt: 1, hits: [{ id: 'loaded', at: timestamp }] });
    const print = vi.spyOn(window, 'print').mockImplementation(() => {});
    const { container, getByRole } = render(<MemoryRouter><Settings /></MemoryRouter>);
    expect(loadUserData).not.toHaveBeenCalled();
    const opener = getByRole('button', { name: existing('settings.print_calendar') });
    opener.focus();
    fireEvent.click(opener);
    const dialog = await waitFor(() => getByRole('dialog'));
    expect(loadUserData).toHaveBeenCalledExactlyOnceWith('testuser');
    expect(print).not.toHaveBeenCalled();
    expect(dialog.querySelector('.print-month-title')).toHaveTextContent(month.toLocaleDateString(localeTags[locale], { month: 'long', year: 'numeric' }));
    expect(texts(dialog, '.print-stat-value')).toEqual(['1', '1']);
    expect(dialog.querySelector('.print-username')).toHaveTextContent('testuser');
    expect(container.querySelector('.print-day-count')).toHaveTextContent('1');
    fireEvent.click(dialog.querySelector('.cancel-btn')!);
    expect(opener).toHaveFocus();
  });
  it('Print dialog and printed sheet resolve every label, Sunday-first weekday, month and date', () => {
    const { container } = render(<PrintCalendar hits={[]} username="testuser" currentMonth={month} onClose={close} timezone="UTC" />);
    checkPrint(container, locale);
    const print = vi.spyOn(window, 'print').mockImplementation(() => {});
    fireEvent.click(container.querySelector('.print-btn')!);
    expect(print).toHaveBeenCalledOnce();
  });
  it('Album page 1 resolves six cards, rarity, owned counts and pagination', async () => {
    const { modal } = await album();
    checkAlbum(modal, locale, 0);
  });
  it('Album page 2 resolves unowned legendary cards, four sentinels and wraparound', async () => {
    const { modal } = await album();
    fireEvent.click(modal.querySelectorAll('button')[2]);
    await waitFor(() => expect(modal.querySelectorAll('h3')).toHaveLength(2));
    checkAlbum(modal, locale, 1);
    fireEvent.click(modal.querySelectorAll('button')[2]);
    await waitFor(() => expect(modal.querySelectorAll('h3')).toHaveLength(6));
    fireEvent.click(modal.querySelectorAll('button')[1]);
    await waitFor(() => expect(modal.querySelectorAll('h3')).toHaveLength(2));
    checkAlbum(modal, locale, 1);
  });
  it('Login language picker has the approved localized accessible name', () => {
    const { container } = render(<Login onLogin={vi.fn()} />);
    expect(container.querySelector('select')).toHaveAccessibleName(expected(locale, 'login.select_language'));
  });
});

describe('Print dialog interaction contract', () => {
  it('traps forward/reverse Tab from the container, boundaries and escaped focus; recovers after printing', async () => {
    const user = userEvent.setup();
    const outside = document.createElement('button');
    document.body.append(outside);
    outside.focus();
    const { container, unmount } = render(<PrintCalendar hits={[]} username="testuser" currentMonth={month} onClose={close} />);
    const dialog = container.querySelector('.print-dialog')!;
    const first = container.querySelector('.print-close-btn') as HTMLElement;
    const last = container.querySelector('.cancel-btn') as HTMLElement;
    expect(dialog).toHaveFocus();
    await user.tab({ shift: true });
    expect(last).toHaveFocus();
    await user.tab();
    expect(first).toHaveFocus();
    await user.tab({ shift: true });
    expect(last).toHaveFocus();
    outside.focus();
    await user.tab();
    expect(first).toHaveFocus();
    outside.focus();
    await user.tab({ shift: true });
    expect(last).toHaveFocus();
    const print = vi.spyOn(window, 'print').mockImplementation(() => outside.focus());
    fireEvent.click(container.querySelector('.print-btn')!);
    expect(print).toHaveBeenCalledOnce();
    expect(dialog.contains(document.activeElement)).toBe(true);
    unmount();
    expect(outside).toHaveFocus();
    expect(document.body).not.toHaveClass('print-mode');
    outside.remove();
  });
  it.each(['escape', 'overlay', 'close', 'cancel'])('closes via %s and returns focus to the connected opener', async path => {
    const { container, getByRole, queryByRole } = render(<MemoryRouter><Settings /></MemoryRouter>);
    const opener = getByRole('button', { name: existing('settings.print_calendar') });
    opener.focus();
    fireEvent.click(opener);
    const dialog = await waitFor(() => getByRole('dialog'));
    fireEvent.click(dialog.querySelector('.print-month-title')!);
    expect(getByRole('dialog')).toBe(dialog);
    if (path === 'escape') fireEvent.keyDown(window, { key: 'Escape' });
    else fireEvent.click(container.querySelector(path === 'overlay' ? '.print-overlay' : path === 'close' ? '.print-close-btn' : '.cancel-btn')!);
    expect(queryByRole('dialog')).toBeNull();
    expect(opener).toHaveFocus();
    expect(document.body).not.toHaveClass('print-mode');
  });
  it('does not restore focus to a disconnected opener', () => {
    const opener = document.createElement('button');
    document.body.append(opener);
    opener.focus();
    const focus = vi.spyOn(opener, 'focus');
    const { unmount } = render(<PrintCalendar hits={[]} username="testuser" currentMonth={month} onClose={close} />);
    opener.remove();
    unmount();
    expect(focus).not.toHaveBeenCalled();
  });
  it.each(['missing', 'rejected'])('Settings falls back to empty hits for %s data', async mode => {
    if (mode === 'missing') vi.mocked(loadUserData).mockResolvedValueOnce(null);
    else vi.mocked(loadUserData).mockRejectedValueOnce(new Error('load unavailable'));
    const { getByRole } = render(<MemoryRouter><Settings /></MemoryRouter>);
    fireEvent.click(getByRole('button', { name: existing('settings.print_calendar') }));
    const dialog = await waitFor(() => getByRole('dialog'));
    expect(texts(dialog, '.print-stat-value')).toEqual(['0', '0']);
    expect(dialog.querySelectorAll('.print-day-number')).toHaveLength(30);
  });
  it('captures the click month once before awaiting the data load', async () => {
    let resolve!: (value: Awaited<ReturnType<typeof loadUserData>>) => void;
    vi.mocked(loadUserData).mockReturnValueOnce(new Promise(done => { resolve = done; }));
    vi.setSystemTime(new Date(2026, 10, 30, 23, 59, 58));
    const { getByRole, queryByRole } = render(<MemoryRouter><Settings /></MemoryRouter>);
    fireEvent.click(getByRole('button', { name: existing('settings.print_calendar') }));
    expect(queryByRole('dialog')).toBeNull();
    vi.setSystemTime(new Date(2026, 11, 1, 0, 0, 1));
    await act(async () => resolve({ username: 'testuser', registeredAt: 1, hits: [] }));
    const dialog = getByRole('dialog');
    expect(dialog.querySelector('.print-month-title')).toHaveTextContent('November 2026');
    expect(dialog.querySelectorAll('.print-day-number')).toHaveLength(30);
  });
});

it('resolves keys on rerender without adding Print/Album language subscriptions or refetching', async () => {
  const { loadUserData } = await import('../storage');
  const { container, rerender } = render(<PrintCalendar hits={[]} username="testuser" currentMonth={month} onClose={close} />);
  for (const locale of locales) {
    act(() => i18n.setLanguage(locale));
    rerender(<PrintCalendar hits={[]} username="testuser" currentMonth={month} onClose={close} />);
    checkPrint(container, locale);
  }
  cleanup();
  const result = await album();
  const calls = vi.mocked(loadUserData).mock.calls.length;
  for (const locale of locales) {
    act(() => i18n.setLanguage(locale));
    result.rerender(<MemoryRouter><GamesHub /></MemoryRouter>);
    checkAlbum(result.modal, locale, 0);
  }
  expect(vi.mocked(loadUserData).mock.calls.length).toBe(calls);
});

it('zh_cn rendered card strings and chrome equal the pinned baseline except the exact authorized rarity/menu changes', async () => {
  i18n.setLanguage('zh_cn');
  const { modal } = await album();
  for (const page of [0, 1]) {
    const cards = baseline.cards.slice(page * 6, page * 6 + 6);
    expect(texts(modal, 'h3')).toEqual(cards.map(card => card.name));
    expect(texts(modal, 'p')).toEqual(cards.map(card => card.description));
    expect(modal.children[2].textContent?.trim()).toBe(baseline.zhCnChrome.pages[page]);
    expect(texts(modal, 'button')).toEqual(baseline.zhCnChrome.buttons);
    if (page === 0) expect(Array.from(modal.children[3].children).filter(card => card.children.length === 5).map(card => card.children[4].textContent?.trim())).toEqual(baseline.zhCnChrome.counts);
    const labels: Record<string, string> = { common: '普通', uncommon: '精良', rare: '稀有', legendary: '传说' };
    expect(Array.from(modal.children[3].children).slice(0, cards.length).map(card => card.children[3].textContent?.trim())).toEqual(cards.map(card => labels[card.rarity]));
    if (page === 0) {
      fireEvent.click(modal.querySelectorAll('button')[2]);
      await waitFor(() => expect(modal.querySelectorAll('h3')).toHaveLength(2));
    }
  }
  cleanup();
  const { container } = render(<MemoryRouter><Navigation username="testuser" onLogout={close} /></MemoryRouter>);
  fireEvent.click(container.querySelector('.nav-user')!);
  expect(texts(container, '.user-menu-text')).toEqual(baseline.zhCnChrome.menu.map(value => value === '关于我们' ? '关于' : value));
});

it('Navigation keeps its existing persistent-route subscription', () => {
  const { container } = render(<MemoryRouter><Navigation username="testuser" onLogout={close} /></MemoryRouter>);
  fireEvent.click(container.querySelector('.nav-user')!);
  for (const locale of locales) {
    act(() => i18n.setLanguage(locale));
    checkNav(container);
  }
});
