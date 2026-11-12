import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { act, cleanup, fireEvent, render, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Navigation } from '../components/Navigation';
import { PrintCalendar } from '../components/PrintCalendar';
import { GamesHub } from '../pages/games/GamesHub';
import { Login } from '../components/Login';
import { i18n } from '../i18n/i18n';
import type { SupportedLanguage } from '../i18n/i18n';
import { collection, copy, localeTags, rarities } from './i18n-copy';
import baseline from './i18n-preservation-baseline.json';

vi.mock('../storage', async importOriginal => {
  const actual = await importOriginal<typeof import('../storage')>();
  return {
    ...actual,
    loadUserData: vi.fn(async () => ({ username: 'testuser', hits: [], settings: { games: { cardDropEnabled: true } }, cardCollections: collection })),
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
