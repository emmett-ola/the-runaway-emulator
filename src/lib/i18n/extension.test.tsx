import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { i18n } from './index';
import { getRandomQuote } from '../../quotes';
import { HitCalendar } from '../../features/run';
import { useDocumentMeta } from '../../app/useDocumentMeta';

vi.mock('animejs', () => ({ animate: vi.fn(), stagger: vi.fn(() => 0) }));
afterEach(() => { cleanup(); i18n.setLanguage('en_us'); vi.restoreAllMocks(); });

it('confines locale branching/data and formatting to libraries, including root quotes', () => {
  function walk(directory: string): string[] {
    return readdirSync(directory, { withFileTypes: true }).flatMap(entry => entry.isDirectory()
      ? walk(resolve(directory, entry.name)) : /\.(ts|tsx)$/.test(entry.name) && !/\.test\./.test(entry.name) ? [resolve(directory, entry.name)] : []);
  }
  const sources = [...walk(resolve('src/features')), ...walk(resolve('src/ui')), resolve('src/quotes.ts')];
  for (const file of sources) {
    const text = readFileSync(file, 'utf8');
    expect(text, file).not.toMatch(/['"](?:en_us|zh_cn|zh_tw|en-US|zh-CN|zh-TW)['"]|toLocale(?:Date|Time)?String|Intl\.(?:DateTimeFormat|NumberFormat)/);
  }
  expect(readFileSync('src/quotes.ts', 'utf8')).not.toMatch(/enQuotes|zhCnQuotes|zhTwQuotes|生活/);
  expect(readFileSync('src/features/run/Dashboard.tsx', 'utf8')).not.toContain('../settings/dataManagement');
});

it.each([
  ['en_us', 'en-US', '2026-11-13: 1 escape dream', 'The only impossible journey is the one you never begin.'],
  ['zh_cn', 'zh-CN', '2026-11-13：1 个跑路梦想', '生活不是等待风暴过去，而是学会在雨中跳舞。'],
  ['zh_tw', 'zh-TW', '2026-11-13：1 個跑路夢想', '生活不是等待風暴過去，而是學會在雨中跳舞。'],
])('localizes document language, calendar tooltip and unchanged first quote: %s', (locale, tag, title, quote) => {
  i18n.setLanguage(locale);
  vi.spyOn(Math, 'random').mockReturnValue(0);
  function Meta() { useDocumentMeta(); return null; }
  const { container } = render(<><Meta /><HitCalendar currentMonth={new Date(2026, 10, 1)} timezone="UTC" hits={[{ id: 'one', at: Date.parse('2026-11-13T12:00:00Z') }]} /></>);
  expect(document.documentElement.lang).toBe(tag);
  expect(container.querySelector('.calendar-day[title^="2026-11-13"]')).toHaveAttribute('title', title);
  expect(getRandomQuote()).toBe(quote);
  act(() => i18n.setLanguage('en_us'));
  expect(document.documentElement.lang).toBe('en-US');
  expect(screen.getByText('November 2026')).toBeInTheDocument();
});
