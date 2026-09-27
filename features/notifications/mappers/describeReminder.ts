import { tr } from '@/features/core/translations';
import { formatClock } from '@/features/core/utils';
import type { ReminderSchedule } from '@/features/notifications/domain/entities/ReminderSchedule';

/** ISO weekdays, Monday first. */
export const ISO_DAYS: readonly number[] = [1, 2, 3, 4, 5, 6, 7];

/**
 * A weekday's name from `Intl`, not from a table of English abbreviations: the platform already
 * holds every locale's names. The reference date is an arbitrary Monday (2024-01-01 was one), so
 * ISO day 1 maps to it and the rest follow.
 */
const weekday = (iso: number, locale: string, width: 'long' | 'short') =>
  new Intl.DateTimeFormat(locale, { weekday: width, timeZone: 'UTC' }).format(new Date(Date.UTC(2024, 0, iso, 12)));

/** The full name, for a checklist row ("Monday", "lunedì"). */
export const dayName = (iso: number, locale: string) => weekday(iso, locale, 'long');

/** "Mon, Wed, Fri" / "Mon-Fri" / "Every day", from an ISO day set. */
export function describeDays(days: readonly number[], locale: string): string {
  const names = ISO_DAYS.filter(iso => days.includes(iso)).map(iso => weekday(iso, locale, 'short'));
  if (names.length === 7) return tr('notif.everyDay');
  if (names.length === 1) return names[0] ?? tr('notif.noDays');

  const sorted = [...days].sort((a, b) => a - b);
  const contiguous = sorted.every((day, index) => index === 0 || day === (sorted[index - 1] ?? Number.NaN) + 1);
  if (contiguous && sorted.length > 2) {
    const firstIso = sorted[0];
    const lastIso = sorted[sorted.length - 1];
    const first = firstIso === undefined ? undefined : weekday(firstIso, locale, 'short');
    const last = lastIso === undefined ? undefined : weekday(lastIso, locale, 'short');
    if (first && last) return `${first}-${last}`;
  }
  return names.join(', ');
}

/**
 * The outcome the user is actually in, which is why it reads three settings at once: "Remind me
 * to train" on while the system says no is the state this sentence exists to catch.
 */
export function reminderHint(reminder: ReminderSchedule, enabled: boolean, granted: boolean, locale: string): string {
  if (!enabled) return tr('notif.offOnScreen');
  if (!granted) return tr('notif.blocked');
  if (!reminder.enabled) return tr('notif.oneNudge');
  if (reminder.days.length === 0) return tr('notif.noDaysSelected');
  return tr('notif.scheduleAt', { days: describeDays(reminder.days, locale), time: formatClock(reminder.minuteOfDay) });
}
