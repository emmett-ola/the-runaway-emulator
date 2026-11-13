import { useEffect, useId, useRef } from 'react';
import type { HitLog } from '../../types';
import { getSavedTimezone, timestampToDateString } from '../../lib/time';
import { i18n } from '../../lib/i18n';
import type { SupportedLanguage } from '../../lib/i18n';
import './PrintCalendar.css';

const LOCALE_TAGS: Record<SupportedLanguage, string> = {
  en_us: 'en-US', zh_cn: 'zh-CN', zh_tw: 'zh-TW',
};

export interface PrintCalendarProps {
  hits: HitLog[];
  username: string;
  currentMonth: Date;
  onClose: () => void;
  timezone?: string;
}

export const PrintCalendar = ({ hits, username, currentMonth, onClose, timezone: propTimezone }: PrintCalendarProps) => {
  const titleId = useId();
  const printRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  const timezone = propTimezone || getSavedTimezone();

  useEffect(() => {
    closeRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    const dialog = printRef.current?.parentElement;
    const opener = document.activeElement;
    document.body.classList.add('print-mode');
    dialog?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        closeRef.current();
        return;
      }
      if (event.key !== 'Tab' || !dialog) return;
      const focusable = Array.from(dialog.querySelectorAll<HTMLElement>('button:not([disabled])'));
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;
      if (!first || !last) {
        event.preventDefault();
        dialog.focus();
      } else if (!dialog.contains(active) || active === dialog) {
        event.preventDefault();
        (event.shiftKey ? last : first).focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      } else if (event.shiftKey && active === first) {
        event.preventDefault();
        last.focus();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.classList.remove('print-mode');
      if (opener instanceof HTMLElement && opener.isConnected) opener.focus();
    };
  }, []);

  const getCalendarDays = () => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();

    const firstDay = new Date(year, month, 1);
    const firstDayOfWeek = firstDay.getDay();

    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();

    const days = [];

    for (let i = 0; i < firstDayOfWeek; i++) {
      days.push(null);
    }

    // Recalculate hit dates based on current timezone
    const hitsByDate = new Map<string, number>();
    hits.forEach(hit => {
      const dateStr = timestampToDateString(hit.at, timezone);
      hitsByDate.set(dateStr, (hitsByDate.get(dateStr) || 0) + 1);
    });

    for (let day = 1; day <= daysInMonth; day++) {
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

  const getIntensity = (count: number) => {
    if (count === 0) return 'intensity-0';
    const ratio = count / maxHits;
    if (ratio < 0.25) return 'intensity-1';
    if (ratio < 0.5) return 'intensity-2';
    if (ratio < 0.75) return 'intensity-3';
    return 'intensity-4';
  };

  const localeTag = LOCALE_TAGS[i18n.getLanguage()];
  const monthName = currentMonth.toLocaleDateString(localeTag, { month: 'long', year: 'numeric' });

  const handlePrint = () => {
    window.print();
    printRef.current?.parentElement?.focus();
  };

  return (
    <div className="print-overlay" onClick={onClose}>
      <div className="print-dialog" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1}>
        <div className="print-dialog-header">
          <h2 id={titleId}>{i18n.t('print.dialog_title')}</h2>
          <button onClick={onClose} className="print-close-btn" aria-label={i18n.t('print.close')}>
            ✕
          </button>
        </div>

        <div className="print-preview" ref={printRef}>
          <div className="print-content">
            <div className="print-header">
              <h1 className="print-title">🏃 {i18n.t('dashboard.brand_title')}</h1>
              <div className="print-user-info">
                <span className="print-username">{username}</span>
                <span className="print-date">{new Date().toLocaleDateString(localeTag, {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric'
                })}</span>
              </div>
            </div>

            <div className="print-calendar-container">
              <h2 className="print-month-title">{monthName}</h2>

              <div className="print-calendar-weekdays">
                <div className="print-weekday">{i18n.t('print.weekday_sun')}</div>
                <div className="print-weekday">{i18n.t('print.weekday_mon')}</div>
                <div className="print-weekday">{i18n.t('print.weekday_tue')}</div>
                <div className="print-weekday">{i18n.t('print.weekday_wed')}</div>
                <div className="print-weekday">{i18n.t('print.weekday_thu')}</div>
                <div className="print-weekday">{i18n.t('print.weekday_fri')}</div>
                <div className="print-weekday">{i18n.t('print.weekday_sat')}</div>
              </div>

              <div className="print-calendar-grid">
                {days.map((day, index) => (
                  day === null ? (
                    <div key={index} className="print-calendar-day empty"></div>
                  ) : (
                    <div
                      key={index}
                      className={`print-calendar-day ${getIntensity(day.count)}`}
                    >
                      <span className="print-day-number">{day.day}</span>
                      {day.count > 0 && <span className="print-day-count">{day.count}</span>}
                    </div>
                  )
                ))}
              </div>

              <div className="print-calendar-legend">
                <span>{i18n.t('print.legend_less')}</span>
                <div className="print-legend-item intensity-0"></div>
                <div className="print-legend-item intensity-1"></div>
                <div className="print-legend-item intensity-2"></div>
                <div className="print-legend-item intensity-3"></div>
                <div className="print-legend-item intensity-4"></div>
                <span>{i18n.t('print.legend_more')}</span>
              </div>

              <div className="print-stats">
                <div className="print-stat-item">
                  <span className="print-stat-label">{i18n.t('print.stats_total')}</span>
                  <span className="print-stat-value">{hits.length}</span>
                </div>
                <div className="print-stat-item">
                  <span className="print-stat-label">{i18n.t('print.stats_month')}</span>
                  <span className="print-stat-value">
                    {days.filter(d => d !== null && d.count > 0).reduce((sum, d) => sum + d!.count, 0)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="print-dialog-actions">
          <div className="print-note">
            {i18n.t('print.tip')}
          </div>
          <div className="print-buttons">
            <button onClick={handlePrint} className="print-btn print-action-btn">
              {i18n.t('print.button_print')}
            </button>
            <button onClick={onClose} className="cancel-btn print-action-btn">
              {i18n.t('print.button_cancel')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
