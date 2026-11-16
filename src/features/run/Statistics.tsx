import { useMemo, useState } from 'react';
import type { HitLog, RunView } from '../../types';
import { timestampToDateString, hourInTimezone } from '../../lib/time';
import { i18n, useT } from '../../lib/i18n';
import './Statistics.css';

interface StatisticsProps {
  view?: RunView;
  hits?: readonly HitLog[];
  timezone: string;
  now?: number;
}

interface DayStats {
  [key: string]: number;
}

interface HourStats {
  [key: number]: number;
}

export const Statistics = ({ view, hits: storedHits, timezone, now: currentTime }: StatisticsProps) => {
  useT();
  const [mountedAt] = useState(() => Date.now());
  const now = currentTime ?? mountedAt;
  const stats = useMemo(() => {
    // Compatibility input is projected here only; runtime receives the verified index.
    const timestamps = view?.timestamps ?? (storedHits ?? []).map((hit, firstOrdinal) => ({ at: hit.at, count: 1, firstOrdinal }));
    const total = view?.total ?? storedHits?.length ?? 0;
    const firstAt = view?.firstAt ?? storedHits?.[0]?.at;
    if (total === 0 || firstAt === undefined || firstAt === null) {
      return {
        total: 0, today: 0, thisWeek: 0, thisMonth: 0,
        longestStreak: 0, currentStreak: 0, averagePerDay: 0,
        mostActiveDay: '', mostActiveHour: '', peakDay: '', peakCount: 0,
      };
    }

    const todayStr = timestampToDateString(now, timezone);
    const todayDay = new Date(`${todayStr}T00:00:00Z`);
    const weekStart = new Date(todayDay);
    weekStart.setUTCDate(todayDay.getUTCDate() - todayDay.getUTCDay());
    const weekStartKey = weekStart.toISOString().slice(0, 10);
    const monthStartKey = `${todayStr.slice(0, 7)}-01`;
    let today = 0;
    let thisWeek = 0;
    let thisMonth = 0;
    const dateStats: DayStats = {};
    const dayStats: DayStats = {};
    const hourStats: HourStats = {};
    const dayFirst: Record<string, number> = {};
    const dateFirst: Record<string, number> = {};
    const dayKeys = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

    timestamps.forEach(({ at, count, firstOrdinal }) => {
      const day = timestampToDateString(at, timezone);
      if (day === todayStr) today += count;
      if (day >= weekStartKey && day <= todayStr) thisWeek += count;
      if (day >= monthStartKey && day <= todayStr) thisMonth += count;
      const dayKey = dayKeys[new Date(`${day}T00:00:00Z`).getUTCDay()];
      dayStats[dayKey] = (dayStats[dayKey] || 0) + count;
      dayFirst[dayKey] = Math.min(dayFirst[dayKey] ?? Infinity, firstOrdinal);
      dateStats[day] = (dateStats[day] || 0) + count;
      dateFirst[day] = Math.min(dateFirst[day] ?? Infinity, firstOrdinal);
      const hour = hourInTimezone(at, timezone);
      hourStats[hour] = (hourStats[hour] || 0) + count;
    });

    let currentStreak = 0;
    let longestStreak = 0;
    let chain = 0;
    let previousDay = -Infinity;
    for (const date of Object.keys(dateStats).sort()) {
      const day = Date.parse(`${date}T00:00:00Z`) / 86400000;
      chain = day - previousDay === 1 ? chain + 1 : 1;
      longestStreak = Math.max(longestStreak, chain);
      if (date === todayStr) currentStreak = chain;
      previousDay = day;
    }

    // Original array insertion order breaks weekday/date ties. Numeric hour keys
    // retain the shipped numeric-key enumeration tie (earliest clock hour).
    const rankByCountThenOrdinal = (counts: DayStats, ordinals: Record<string, number>) =>
      Object.entries(counts).sort((a, b) => b[1] - a[1] || ordinals[a[0]] - ordinals[b[0]])[0];
    const mostActiveDay = rankByCountThenOrdinal(dayStats, dayFirst)[0];
    const [peakDay, peakCount] = rankByCountThenOrdinal(dateStats, dateFirst);
    const mostActiveHourNum = Object.entries(hourStats).reduce((a, b) => b[1] > a[1] ? b : a, ['0', 0])[0];
    const daysSinceFirst = Math.max(1, Math.ceil((now - firstAt) / 86400000));
    return {
      total, today, thisWeek, thisMonth, longestStreak, currentStreak,
      averagePerDay: Math.round(total / daysSinceFirst * 10) / 10,
      mostActiveDay,
      mostActiveHour: `${mostActiveHourNum}:00 - ${parseInt(mostActiveHourNum) + 1}:00`,
      peakDay, peakCount,
    };
  }, [view, storedHits, timezone, now]);

  return (
      <div className="statistics-container">
        <h3 className="statistics-title">📊 {i18n.t('statistics.title')}</h3>
      
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-value">{stats.total}</div>
            <div className="stat-label">{i18n.t('statistics.total')}</div>
          </div>

          <div className="stat-card">
            <div className="stat-value">{stats.today}</div>
            <div className="stat-label">{i18n.t('statistics.today')}</div>
          </div>

          <div className="stat-card">
            <div className="stat-value">{stats.thisWeek}</div>
            <div className="stat-label">{i18n.t('statistics.this_week')}</div>
          </div>

          <div className="stat-card">
            <div className="stat-value">{stats.thisMonth}</div>
            <div className="stat-label">{i18n.t('statistics.this_month')}</div>
          </div>

          <div className="stat-card">
            <div className="stat-value">{stats.averagePerDay}</div>
            <div className="stat-label">{i18n.t('statistics.average_per_day')}</div>
          </div>

          <div className="stat-card">
            <div className="stat-value">{stats.currentStreak}</div>
            <div className="stat-label">{i18n.t('statistics.current_streak')}</div>
          </div>

          <div className="stat-card">
            <div className="stat-value">{stats.longestStreak}</div>
            <div className="stat-label">{i18n.t('statistics.longest_streak')}</div>
          </div>

          <div className="stat-card">
            <div className="stat-value">{stats.peakCount}</div>
            <div className="stat-label">{i18n.t('statistics.peak_day')}</div>
          </div>
        </div>

        <div className="stats-insights">
          <div className="insight-item">
            <span className="insight-icon">📅</span>
            <span className="insight-text">
              {i18n.t('statistics.most_active_on')} <strong>{stats.mostActiveDay ? i18n.t(`statistics.${stats.mostActiveDay}`) : 'N/A'}</strong>
            </span>
          </div>

          <div className="insight-item">
            <span className="insight-icon">🕐</span>
            <span className="insight-text">
              {i18n.t('statistics.peak_runaway_time')} <strong>{stats.mostActiveHour || 'N/A'}</strong>
            </span>
          </div>

          {stats.peakDay && (
            <div className="insight-item">
              <span className="insight-icon">🔥</span>
              <span className="insight-text">
                {i18n.t('statistics.record_day')} <strong>{stats.peakCount} {i18n.t('statistics.runaways')}</strong> {i18n.t('statistics.on')} {stats.peakDay}
              </span>
            </div>
          )}
        </div>
      </div>
    );
};
