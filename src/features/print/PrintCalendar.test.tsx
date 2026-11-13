import { readFileSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, waitFor, within } from '@testing-library/react';
import { useState } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { PrintCalendar } from './index';
import { HitCalendar } from '../run';
import { Settings } from '../settings';
import { i18n, type SupportedLanguage } from '../../lib/i18n';
import { writeRecord } from '../../lib/storage';
import type { HitLog } from '../../types';
import { copy, localeTags } from '../../test/i18n-copy';

vi.mock('animejs', () => ({ animate: vi.fn(), stagger: vi.fn(() => 0) }));

const month = new Date(2026, 10, 1);
const hits: HitLog[] = [
  { id: 'boundary', at: Date.UTC(2026, 11, 1, 1) },
  { id: 'same-day', at: Date.UTC(2026, 11, 1, 2) },
  { id: 'december', at: Date.UTC(2026, 11, 15, 12) },
];
const values = (root: ParentNode, selector: string) =>
  Array.from(root.querySelectorAll(selector), node => node.textContent);
const dayCount = (root: ParentNode, day: number) =>
  Array.from(root.querySelectorAll('.print-calendar-day')).find(cell =>
    cell.querySelector('.print-day-number')?.textContent === String(day),
  )?.querySelector('.print-day-count')?.textContent ?? '0';

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  sessionStorage.setItem('runawaylog-username', 'print-user');
  localStorage.setItem('runawaylog-timezone', 'America/Los_Angeles');
  i18n.setLanguage('en_us');
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(2026, 10, 12, 12));
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
  i18n.setLanguage('en_us');
});

describe('print feature regression contract', () => {
  it('Settings opens the current month from the persisted record without invoking window.print', async () => {
    writeRecord({ username: 'print-user', hits, registeredAt: 1, profile: {} });
    const print = vi.spyOn(window, 'print').mockImplementation(() => {});
    const { getByRole, queryByRole } = render(<MemoryRouter><Settings /></MemoryRouter>);
    expect(queryByRole('dialog')).toBeNull();
    const opener = getByRole('button', { name: i18n.t('settings.print_calendar') });
    opener.focus();
    fireEvent.click(opener);
    const dialog = await waitFor(() => getByRole('dialog', { name: 'Print Calendar' }));
    expect(dialog.querySelector('.print-month-title')).toHaveTextContent('November 2026');
    expect(dialog.querySelector('.print-username')).toHaveTextContent('print-user');
    expect(values(dialog, '.print-stat-value')).toEqual(['3', '2']);
    expect(dayCount(dialog, 30)).toBe('2');
    expect(print).not.toHaveBeenCalled();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    expect(queryByRole('dialog')).toBeNull();
    expect(opener).toHaveFocus();
    expect(document.body).not.toHaveClass('print-mode');
  });

  it('follows the existing calendar previous/next month owner across a year boundary without accumulating sheets', () => {
    function MonthOwner() {
      const [currentMonth, setCurrentMonth] = useState(new Date(2026, 11, 1));
      return <>
        <HitCalendar hits={hits} currentMonth={currentMonth} onMonthChange={setCurrentMonth} timezone="UTC" />
        <PrintCalendar hits={hits} username="print-user" currentMonth={currentMonth} onClose={vi.fn()} timezone="UTC" />
      </>;
    }
    const print = vi.spyOn(window, 'print').mockImplementation(() => {});
    const { container, getByRole } = render(<MonthOwner />);
    const check = (title: string, length: number, total: string) => {
      expect(container.querySelectorAll('.print-content')).toHaveLength(1);
      expect(container.querySelectorAll('.print-calendar-grid')).toHaveLength(1);
      expect(container.querySelector('.print-month-title')).toHaveTextContent(title);
      expect(container.querySelectorAll('.print-day-number')).toHaveLength(length);
      expect(values(container, '.print-stat-value')).toEqual(['3', total]);
    };
    check('December 2026', 31, '3');
    fireEvent.click(getByRole('button', { name: '→' }));
    check('January 2027', 31, '0');
    fireEvent.click(getByRole('button', { name: '←' }));
    check('December 2026', 31, '3');
    fireEvent.click(getByRole('button', { name: '←' }));
    check('November 2026', 30, '0');
    expect(print).not.toHaveBeenCalled();
  });

  it('rebuckets stored at instants when the timezone or controlled month changes', () => {
    const props = { hits, username: 'print-user', currentMonth: month, onClose: vi.fn() };
    const before = JSON.stringify(hits);
    const { container, rerender } = render(<PrintCalendar {...props} />);
    expect(dayCount(container, 30)).toBe('2');
    expect(values(container, '.print-stat-value')).toEqual(['3', '2']);
    rerender(<PrintCalendar {...props} timezone="UTC" />);
    expect(dayCount(container, 30)).toBe('0');
    expect(values(container, '.print-stat-value')).toEqual(['3', '0']);
    rerender(<PrintCalendar {...props} currentMonth={new Date(2026, 11, 1)} timezone="UTC" />);
    expect(dayCount(container, 1)).toBe('2');
    expect(dayCount(container, 15)).toBe('1');
    expect(values(container, '.print-stat-value')).toEqual(['3', '3']);
    expect(JSON.stringify(hits)).toBe(before);
  });

  it.each<SupportedLanguage>(['en_us', 'zh_cn', 'zh_tw'])('retains localized dialog controls, dates and calendar-only sheet in %s', locale => {
    i18n.setLanguage(locale);
    const print = vi.spyOn(window, 'print').mockImplementation(() => {});
    const onClose = vi.fn();
    const { container, getByRole } = render(<PrintCalendar hits={hits} username="print-user" currentMonth={month} onClose={onClose} timezone="UTC" />);
    const dialog = getByRole('dialog', { name: copy['print.dialog_title'][locale] });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveFocus();
    expect(container.querySelector('.print-month-title')).toHaveTextContent(month.toLocaleDateString(localeTags[locale], { month: 'long', year: 'numeric' }));
    const sheet = container.querySelector('.print-content')!;
    expect(sheet.querySelectorAll('.print-calendar-container')).toHaveLength(1);
    expect(sheet.querySelectorAll('.print-weekday')).toHaveLength(7);
    expect(sheet.querySelectorAll('.print-day-number')).toHaveLength(30);
    expect(values(sheet, '.print-weekday')).toEqual(['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'].map(day => copy[`print.weekday_${day}`][locale]));
    expect(sheet.querySelector('button, .print-dialog-header, .print-dialog-actions')).toBeNull();
    expect(print).not.toHaveBeenCalled();
    fireEvent.click(within(dialog).getByRole('button', { name: copy['print.button_print'][locale] }));
    expect(print).toHaveBeenCalledOnce();
    expect(dialog).toHaveFocus();
    fireEvent.click(within(dialog).getByRole('button', { name: copy['print.close'][locale] }));
    fireEvent.click(within(dialog).getByRole('button', { name: copy['print.button_cancel'][locale] }));
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(3);
  });
});

// Structural CSS evidence only: jsdom does not paginate or produce browser PDFs.
function block(source: string, selector: string) {
  const start = source.indexOf(selector);
  expect(start, `missing CSS rule ${selector}`).toBeGreaterThanOrEqual(0);
  const open = source.indexOf('{', start);
  let depth = 1;
  let end = open + 1;
  for (; end < source.length && depth; end++) {
    if (source[end] === '{') depth++;
    if (source[end] === '}') depth--;
  }
  expect(depth).toBe(0);
  return source.slice(open + 1, end - 1);
}

it('declares A4, excludes application/dialog chrome and prevents splitting the single month sheet', () => {
  const css = readFileSync('src/features/print/PrintCalendar.css', 'utf8');
  const print = block(css, '@media print');
  expect(block(print, '@page')).toMatch(/size:\s*A4\s*;/);
  expect(block(print, '@page')).toMatch(/margin:\s*1cm\s*;/);
  expect(block(print, 'body *')).toMatch(/visibility:\s*hidden\s*;/);
  expect(block(print, '.print-overlay,')).toMatch(/visibility:\s*visible\s*;/);
  expect(block(print, 'body.print-mode #root *:not(.print-overlay):not(.print-overlay *):not(:has(.print-overlay))')).toMatch(/display:\s*none\s*!important/);
  expect(block(print, '.print-dialog-header,')).toMatch(/display:\s*none\s*!important/);
  expect(print).toMatch(/\.print-content\s*\{[^}]*page-break-after:\s*avoid;[^}]*page-break-inside:\s*avoid;/);
  expect(print).toMatch(/\.print-calendar-container\s*\{[^}]*page-break-inside:\s*avoid;/);
  expect(print).toMatch(/\.print-preview\s*\{[^}]*overflow:\s*visible;/);
  expect(print).toMatch(/print-color-adjust:\s*exact;/);
});
