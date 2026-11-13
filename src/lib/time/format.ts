import { i18n } from '../i18n';

export function formatDate(date: Date | number, options: Intl.DateTimeFormatOptions): string {
  return new Date(date).toLocaleDateString(i18n.getMetadata().tag, options);
}

export const formatMonth = (date: Date) => formatDate(date, { month: 'long', year: 'numeric' });
export const formatLongDate = (date: Date | number, timeZone?: string) => formatDate(date, { year: 'numeric', month: 'long', day: 'numeric', timeZone });
export const formatNumber = (value: number) => new Intl.NumberFormat(i18n.getMetadata().tag).format(value);
export const formatClock = (date: Date, timeZone: string) => date.toLocaleTimeString(i18n.getMetadata().tag, { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false, timeZone });
export const hourInTimezone = (timestamp: number, timeZone: string) => Number(new Intl.DateTimeFormat('en-US', { timeZone, hour: 'numeric', hourCycle: 'h23' }).format(timestamp));

const weekdays = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
export const calendarWeekdays = () => weekdays.map(day => i18n.t(`statistics.${day}`).slice(0, i18n.getMetadata().calendarWeekdayLength));

export function formatMemberDuration(registeredAt: number, now = Date.now()): string {
  const days = Math.ceil(Math.abs(now - registeredAt) / 86400000);
  const unit = (name: string, count: number) => i18n.t(`profile.${name}_${count === 1 ? 'one' : 'many'}`, { count: formatNumber(count) });
  if (days < 30) return unit('day', days);
  if (days < 365) return unit('month', Math.floor(days / 30));
  const years = unit('year', Math.floor(days / 365));
  const months = Math.floor((days % 365) / 30);
  return months ? i18n.t('profile.duration_pair', { years, months: unit('month', months) }) : years;
}
