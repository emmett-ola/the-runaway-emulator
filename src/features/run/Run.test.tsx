import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Dashboard } from './Dashboard';
import { SceneSession } from '../scene';
import { Statistics } from './Statistics';
import { HitCalendar } from './HitCalendar';
import { HitLogs } from './HitLogs';
import { writeRecord, readRecord } from '../../lib/storage';
import { i18n } from '../../lib/i18n';

vi.mock('animejs', () => ({ animate: vi.fn(), stagger: vi.fn(() => 0) }));
beforeEach(() => {
  localStorage.clear();
  i18n.setLanguage('en_us');
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-11-13T01:00:00Z'));
  vi.spyOn(Math, 'random').mockReturnValue(0.5);
  writeRecord({ username: 'runner', hits: [], profile: { registrationDate: 1 } });
});
afterEach(() => { cleanup(); vi.useRealTimers(); vi.restoreAllMocks(); });
const settle = async () => { await act(async () => { await vi.advanceTimersByTimeAsync(900); }); };
const run = () => screen.getAllByRole('button', { name: /RUN/ });

describe('run-owned invariants', () => {
  it('records once under double press and claims the scene once across route remounts, rearming only for a new page tree', async () => {
    function Page({ home }: { home: boolean }) {
      return <SceneSession>{home && <Dashboard username="runner" onLogout={() => {}} showHeader={false} />}</SceneSession>;
    }
    const view = render(<Page home />);
    await act(async () => {});
    act(() => { run()[0].click(); run()[0].click(); });
    await settle();
    expect(readRecord('runner')?.hits).toHaveLength(1);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: i18n.t('run_scene.skip') }));
    expect(run()[0]).toHaveFocus();
    view.rerender(<Page home={false} />);
    view.rerender(<Page home />);
    await act(async () => {});
    fireEvent.click(run()[0]);
    await settle();
    expect(readRecord('runner')?.hits).toHaveLength(2);
    expect(screen.queryByRole('dialog')).toBeNull();
    view.unmount();
    render(<Page home />);
    await act(async () => {});
    fireEvent.click(run()[0]);
    await settle();
    expect(readRecord('runner')?.hits).toHaveLength(3);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('wrong fork and boom neither count nor consume the scene; all fork controls are reachable and the successful trigger regains focus', async () => {
    writeRecord({ username: 'runner', hits: [], profile: { registrationDate: 1 }, settings: { games: { forkInTheRoadEnabled: true } } });
    render(<SceneSession><Dashboard username="runner" onLogout={() => {}} showHeader={false} /></SceneSession>);
    await act(async () => {});
    expect(run()).toHaveLength(3);
    expect(run().every(button => button.tabIndex === 0)).toBe(true);
    fireEvent.click(run()[0]);
    await settle();
    expect(readRecord('runner')?.hits).toHaveLength(0);
    expect(screen.queryByRole('dialog')).toBeNull();
    vi.mocked(Math.random).mockReturnValue(0);
    fireEvent.click(run()[1]);
    await settle();
    expect(readRecord('runner')?.hits).toHaveLength(0);
    expect(screen.queryByRole('dialog')).toBeNull();
    vi.mocked(Math.random).mockReturnValue(0.5);
    const trigger = run()[0];
    fireEvent.click(trigger);
    await settle();
    expect(readRecord('runner')?.hits).toHaveLength(1);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(trigger).toHaveFocus();
  });

  it('statistics, calendar and logs rebucket the same timestamp without trusting or mutating legacy dates', () => {
    const hits = [{ id: 'boundary', timestamp: Date.parse('2026-11-13T01:00:00Z'), date: '1999-01-01' }];
    const before = JSON.stringify(hits);
    const view = (timezone: string) => <><Statistics hits={hits} timezone={timezone} /><HitCalendar hits={hits} currentMonth={new Date(2026, 10, 1)} timezone={timezone} /><HitLogs hits={hits} timezone={timezone} /></>;
    const { container, rerender } = render(view('America/Los_Angeles'));
    expect(container.querySelectorAll('.stat-card .stat-value')[1]).toHaveTextContent('1');
    expect(container.querySelector('.calendar-day[title^="2026-11-12"] .day-count')).toHaveTextContent('1');
    expect(container.querySelectorAll('.log-item')).toHaveLength(1);
    rerender(view('UTC'));
    expect(container.querySelectorAll('.stat-card .stat-value')[1]).toHaveTextContent('1');
    expect(container.querySelector('.calendar-day[title^="2026-11-13"] .day-count')).toHaveTextContent('1');
    expect(container.querySelectorAll('.log-item')).toHaveLength(1);
    expect(JSON.stringify(hits)).toBe(before);
  });
});
