import { useEffect, useRef, useState } from 'react';
import { animate, stagger } from 'animejs';
import type { HitLog } from '../../types';
import { getSavedTimezone, timestampToDateString } from '../../lib/time';
import { i18n, useT } from '../../lib/i18n';
import './HitCalendar.css';

interface HitCalendarProps {
  hits: HitLog[];
  currentMonth?: Date;
  onMonthChange?: (date: Date) => void;
  timezone?: string;
}

export const HitCalendar = ({ hits, currentMonth: propCurrentMonth, onMonthChange, timezone: propTimezone }: HitCalendarProps) => {
  useT();
  const containerRef = useRef<HTMLDivElement>(null);
  const [internalMonth, setInternalMonth] = useState(new Date());
  
  const currentMonth = propCurrentMonth || internalMonth;
  const setCurrentMonth = onMonthChange || setInternalMonth;
  const timezone = propTimezone || getSavedTimezone();

  useEffect(() => {
    if (containerRef.current) {
      const days = containerRef.current.querySelectorAll('.calendar-day');
      animate(days, {
        opacity: [0, 1],
        scale: [0.8, 1],
        delay: stagger(10),
        duration: 300,
        ease: 'out(3)',
      });
    }
  }, [hits, currentMonth]);

  // Get calendar days for current month
  const getCalendarDays = () => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    
    // First day of the month
    const firstDay = new Date(year, month, 1);
    const firstDayOfWeek = firstDay.getDay(); // 0 = Sunday
    
    // Last day of the month
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    
    const days = [];
    
    // Add empty cells for days before month starts
    for (let i = 0; i < firstDayOfWeek; i++) {
      days.push(null);
    }
    
    // Recalculate hit dates based on current timezone
    const hitsByDate = new Map<string, number>();
    hits.forEach(hit => {
      const dateStr = timestampToDateString(hit.at, timezone);
      hitsByDate.set(dateStr, (hitsByDate.get(dateStr) || 0) + 1);
    });
    
    // Add all days in the month
    for (let day = 1; day <= daysInMonth; day++) {
      // Create date string in YYYY-MM-DD format for the current timezone
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const hitCount = hitsByDate.get(dateStr) || 0;
      
      days.push({
        date: dateStr,
        count: hitCount,
        day: day,
      });
    }
    
    return days;
  };

  const days = getCalendarDays();
  const maxHits = Math.max(...days.filter(d => d !== null).map(d => d!.count), 1);

  const goToPreviousMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1));
  };

  const goToNextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1));
  };

  const goToToday = () => {
    setCurrentMonth(new Date());
  };

  const monthName = currentMonth.toLocaleDateString(i18n.getLanguage() === 'zh_cn' || i18n.getLanguage() === 'zh_tw' ? 'zh-CN' : 'en-US', { month: 'long', year: 'numeric' });

  const getIntensity = (count: number) => {
    if (count === 0) return 'intensity-0';
    const ratio = count / maxHits;
    if (ratio < 0.25) return 'intensity-1';
    if (ratio < 0.5) return 'intensity-2';
    if (ratio < 0.75) return 'intensity-3';
    return 'intensity-4';
  };

  return (
    <div className="calendar-container" ref={containerRef}>
      <div className="calendar-header">
        <button onClick={goToPreviousMonth} className="calendar-nav-btn">←</button>
        <h3 className="calendar-title">{monthName}</h3>
        <button onClick={goToNextMonth} className="calendar-nav-btn">→</button>
      </div>
      <button onClick={goToToday} className="calendar-today-btn">{i18n.t('statistics.today')}</button>
      
      <div className="calendar-weekdays">
        <div className="weekday">{i18n.t('statistics.sunday').substring(0, i18n.getLanguage().startsWith('zh') ? 1 : 3)}</div>
        <div className="weekday">{i18n.t('statistics.monday').substring(0, i18n.getLanguage().startsWith('zh') ? 1 : 3)}</div>
        <div className="weekday">{i18n.t('statistics.tuesday').substring(0, i18n.getLanguage().startsWith('zh') ? 1 : 3)}</div>
        <div className="weekday">{i18n.t('statistics.wednesday').substring(0, i18n.getLanguage().startsWith('zh') ? 1 : 3)}</div>
        <div className="weekday">{i18n.t('statistics.thursday').substring(0, i18n.getLanguage().startsWith('zh') ? 1 : 3)}</div>
        <div className="weekday">{i18n.t('statistics.friday').substring(0, i18n.getLanguage().startsWith('zh') ? 1 : 3)}</div>
        <div className="weekday">{i18n.t('statistics.saturday').substring(0, i18n.getLanguage().startsWith('zh') ? 1 : 3)}</div>
      </div>
      
      <div className="calendar-grid">
        {days.map((day, index) => (
          day === null ? (
            <div key={index} className="calendar-day empty"></div>
          ) : (
            <div
              key={index}
              className={`calendar-day ${getIntensity(day.count)}`}
              title={`${day.date}: ${day.count} escape dream${day.count !== 1 ? 's' : ''}`}
            >
              <span className="day-number">{day.day}</span>
              {day.count > 0 && <span className="day-count">{day.count}</span>}
            </div>
          )
        ))}
      </div>
      
      <div className="calendar-legend">
        <span>{i18n.t('statistics.less')}</span>
        <div className="legend-item intensity-0"></div>
        <div className="legend-item intensity-1"></div>
        <div className="legend-item intensity-2"></div>
        <div className="legend-item intensity-3"></div>
        <div className="legend-item intensity-4"></div>
        <span>{i18n.t('statistics.more')}</span>
      </div>
    </div>
  );
};
