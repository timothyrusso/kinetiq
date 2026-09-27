import type { ReminderSchedule } from '@/features/notifications/domain/entities/ReminderSchedule';

/**
 * The next occurrence of the reminder after `now`, or `null` when there is none (off, or no day
 * picked).
 *
 * `minuteOfDay` is read in device-local time and the result is a local date, so the reminder
 * follows the user across time zones rather than firing at 3 a.m. because they flew east.
 */
export function nextReminderDate(reminder: ReminderSchedule, now: Date): Date | null {
  if (!reminder.enabled || reminder.days.length === 0) return null;
  const hour = Math.floor(reminder.minuteOfDay / 60);
  const minute = reminder.minuteOfDay % 60;

  for (let offset = 0; offset < 8; offset += 1) {
    const candidate = new Date(now);
    candidate.setDate(now.getDate() + offset);
    candidate.setHours(hour, minute, 0, 0);
    // NOTE: getDay() counts from 0 = Sunday; ISO weekdays run 1 = Monday to 7 = Sunday.
    const iso = candidate.getDay() === 0 ? 7 : candidate.getDay();
    if (reminder.days.includes(iso) && candidate.getTime() > now.getTime()) return candidate;
  }
  return null;
}
