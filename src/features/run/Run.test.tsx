import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Dashboard } from './Dashboard';
import { SceneSession } from '../scene';
import { Statistics } from './Statistics';
import { HitCalendar } from './HitCalendar';
import { HitLogs } from './HitLogs';
import { writeRecord, readRecord } from '../../lib/storage';
import { i18n } from '../../lib/i18n';
import { registerRunGame } from '../games';

vi.mock('animejs', () => ({ animate: vi.fn(), stagger: vi.fn(() => 0) }));
beforeEach(() => {
  localStorage.clear();
  i18n.setLanguage('en_us');
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-11-13T01:00:00Z'));
  vi.spyOn(Math, 'random').mockReturnValue(0.5);
  writeRecord({ username: 'runner', hits: [], registeredAt: 1, profile: {} });
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
    writeRecord({ username: 'runner', hits: [], registeredAt: 1, profile: {}, settings: { games: { forkInTheRoadEnabled: true } } });
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

  it('renders an independently registered two-control game and respects count, scene and wrong animation outcomes', async () => {
    const dispose = registerRunGame({
      id: 'extension-probe',
      enabled: settings => settings.extensionProbe === true,
      createRound: () => ({
        controls: [{ id: 'wrong', labelKey: 'dashboard.run_button' }, { id: 'count-only', labelKey: 'dashboard.run_button' }],
        resolve: id => ({ count: id === 'count-only', scene: false, wrongAnimation: id === 'wrong' }),
      }),
    });
    try {
      writeRecord({ username: 'runner', hits: [], registeredAt: 1, settings: { games: { extensionProbe: true } } });
      const { container } = render(<SceneSession><Dashboard username="runner" onLogout={() => {}} showHeader={false} /></SceneSession>);
      await act(async () => {});
      expect(run()).toHaveLength(2);
      fireEvent.click(run()[0]);
      await settle();
      expect(readRecord('runner')?.hits).toHaveLength(0);
      expect(container.querySelector('.sweat-drop')).toBeInTheDocument();
      fireEvent.click(run()[1]);
      await settle();
      expect(readRecord('runner')?.hits).toHaveLength(1);
      expect(screen.queryByRole('dialog')).toBeNull();
      vi.mocked(Math.random).mockReturnValue(0);
      fireEvent.click(run()[1]);
      await settle();
      expect(readRecord('runner')?.hits).toHaveLength(1);
      expect(screen.queryByRole('dialog')).toBeNull();
    } finally { dispose(); }
  });

  it.each([
    ['empty', [], 0, 0],
    ['today only', ['2026-11-13'], 1, 1],
    ['yesterday only', ['2026-11-12'], 0, 1],
    ['historical November 1/2', ['2026-11-01', '2026-11-02'], 0, 2],
    ['today streak independent of longer history', ['2026-11-01', '2026-11-02', '2026-11-03', '2026-11-12', '2026-11-13'], 2, 3],
    ['duplicate days and gaps', ['2026-11-10', '2026-11-10', '2026-11-12', '2026-11-13'], 2, 2],
  ] as const)('computes independent current/longest streaks: %s', (_name, dates, current, longest) => {
    const hits = dates.map((date, index) => ({ id: String(index), at: Date.parse(`${date}T00:30:00Z`) }));
    const { container } = render(<Statistics hits={hits} timezone="UTC" />);
    const values = container.querySelectorAll('.stat-card .stat-value');
    expect(values[5]).toHaveTextContent(String(current));
    expect(values[6]).toHaveTextContent(String(longest));
  });

  it('derives streak days from at in the selected timezone, including DST calendar days', () => {
    vi.setSystemTime(new Date('2026-11-02T01:00:00Z'));
    const hits = ['2026-10-31T12:00:00Z', '2026-11-01T12:00:00Z'].map((at, index) => ({ id: String(index), at: Date.parse(at), date: 'stale' }));
    const { container, rerender } = render(<Statistics hits={hits} timezone="UTC" />);
    const values = () => container.querySelectorAll('.stat-card .stat-value');
    expect(values()[5]).toHaveTextContent('0');
    expect(values()[6]).toHaveTextContent('2');
    rerender(<Statistics hits={hits} timezone="America/Los_Angeles" />);
    expect(values()[5]).toHaveTextContent('2');
    expect(values()[6]).toHaveTextContent('2');
  });

  it('statistics, calendar and logs rebucket the same stored instant without mutating v2 hits', () => {
    const hits = [{ id: 'boundary', at: Date.parse('2026-11-13T01:00:00Z') }];
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
