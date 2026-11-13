import { useMemo } from 'react';
import type { HitLog } from '../../types';
import { timestampToDateString } from '../../lib/time';
import { i18n, useT } from '../../lib/i18n';
import './Statistics.css';

interface StatisticsProps {
  hits: HitLog[];
  timezone: string;
}

interface DayStats {
  [key: string]: number;
}

interface HourStats {
  [key: number]: number;
}

export const Statistics = ({ hits: storedHits, timezone }: StatisticsProps) => {
  useT();
  const stats = useMemo(() => {
    const hits = storedHits.map(hit => ({ ...hit, date: timestampToDateString(hit.timestamp, timezone) }));
    if (hits.length === 0) {
      return {
        total: 0,
        today: 0,
        thisWeek: 0,
        thisMonth: 0,
        longestStreak: 0,
        currentStreak: 0,
        averagePerDay: 0,
        mostActiveDay: '',
        mostActiveHour: '',
        peakDay: '',
        peakCount: 0,
      };
    }

    const now = Date.now();
    const todayStr = timestampToDateString(now, timezone);
    
    const todayDay = new Date(`${todayStr}T00:00:00Z`);
    const weekStart = new Date(todayDay);
    weekStart.setUTCDate(todayDay.getUTCDate() - todayDay.getUTCDay());
    const weekStartKey = weekStart.toISOString().slice(0, 10);
    const monthStartKey = `${todayStr.slice(0, 7)}-01`;

    // Count hits by period
    let today = 0;
    let thisWeek = 0;
    let thisMonth = 0;

    hits.forEach(hit => {
      if (hit.date === todayStr) today++;
      if (hit.date >= weekStartKey && hit.date <= todayStr) thisWeek++;
      if (hit.date >= monthStartKey && hit.date <= todayStr) thisMonth++;
    });

    // Calculate streaks
    const sortedHits = [...hits].sort((a, b) => b.timestamp - a.timestamp);
    const uniqueDates = Array.from(new Set(sortedHits.map(h => h.date))).sort().reverse();
    
    let currentStreak = 0;
    let longestStreak = 0;
    let tempStreak = 0;
    
    for (let i = 0; i < uniqueDates.length; i++) {
      const currentDate = new Date(uniqueDates[i]);
      
      if (i === 0) {
        const today = new Date(todayStr);
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        
        if (uniqueDates[i] === todayStr || uniqueDates[i] === yesterday.toISOString().split('T')[0]) {
          currentStreak = 1;
          tempStreak = 1;
        }
      } else {
        const prevDate = new Date(uniqueDates[i - 1]);
        const dayDiff = Math.floor((prevDate.getTime() - currentDate.getTime()) / (1000 * 60 * 60 * 24));
        
        if (dayDiff === 1) {
          tempStreak++;
          if (i === 1 || currentStreak > 0) {
            currentStreak = tempStreak;
          }
        } else {
          tempStreak = 1;
        }
      }
      
      longestStreak = Math.max(longestStreak, tempStreak);
    }

    // Calculate average per day
    const firstHit = hits[0];
    const daysSinceFirst = Math.max(1, Math.ceil((now - firstHit.timestamp) / (1000 * 60 * 60 * 24)));
    const averagePerDay = hits.length / daysSinceFirst;

    // Most active day of week
    const dayStats: DayStats = {};
    const dayKeys = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    
    hits.forEach(hit => {
      const dayKey = dayKeys[new Date(`${hit.date}T00:00:00Z`).getUTCDay()];
      dayStats[dayKey] = (dayStats[dayKey] || 0) + 1;
    });
    
    const mostActiveDay = Object.entries(dayStats).reduce((a, b) => 
      b[1] > a[1] ? b : a, ['', 0]
    )[0];

    // Most active hour
    const hourStats: HourStats = {};
    
    hits.forEach(hit => {
      const hour = Number(new Intl.DateTimeFormat('en-US', { timeZone: timezone, hour: 'numeric', hourCycle: 'h23' }).format(hit.timestamp));
      hourStats[hour] = (hourStats[hour] || 0) + 1;
    });
    
    const mostActiveHourNum = Object.entries(hourStats).reduce((a, b) => 
      b[1] > a[1] ? b : a, ['0', 0]
    )[0];
    
    const mostActiveHour = `${mostActiveHourNum}:00 - ${parseInt(mostActiveHourNum) + 1}:00`;

    // Peak day (most hits in a single day)
    const dateStats: DayStats = {};
    
    hits.forEach(hit => {
      dateStats[hit.date] = (dateStats[hit.date] || 0) + 1;
    });
    
    const [peakDay, peakCount] = Object.entries(dateStats).reduce((a, b) => 
      b[1] > a[1] ? b : a, ['', 0]
    );

    return {
      total: hits.length,
      today,
      thisWeek,
      thisMonth,
      longestStreak,
      currentStreak,
      averagePerDay: Math.round(averagePerDay * 10) / 10,
      mostActiveDay,
      mostActiveHour,
      peakDay,
      peakCount,
    };
  }, [storedHits, timezone]);

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
