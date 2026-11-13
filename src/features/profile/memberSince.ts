import { i18n } from '../../lib/i18n';

export function formatMemberSince(registrationDate: number, now = Date.now()): string {
  const days = Math.ceil(Math.abs(now - registrationDate) / 86400000);
  const unit = (name: string, count: number) => i18n.t(`profile.${name}_${count === 1 ? 'one' : 'many'}`, { count });
  if (days < 30) return unit('day', days);
  if (days < 365) return unit('month', Math.floor(days / 30));
  const years = unit('year', Math.floor(days / 365));
  const months = Math.floor((days % 365) / 30);
  return months ? i18n.t('profile.duration_pair', { years, months: unit('month', months) }) : years;
}
