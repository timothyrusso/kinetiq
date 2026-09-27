/**
 * The imperative calls the legacy bootstrap still makes, run through the app runtime over the
 * `notifications` use cases. A denial degrades, never blocks: every call resolves, with `null` or
 * nothing when a notification could not be posted. Goes away when bootstrap calls the use cases
 * itself (#54).
 */
import { runtime } from '@/features/core/runtime';
import {
  installNotificationHandler as installHandler,
  type NotificationPermission,
  type ReminderSchedule,
  readNotificationPermission as readPermission,
  syncTrainingReminder as syncReminder,
} from '@/features/notifications';

export function installNotificationHandler(): void {
  void runtime.runPromise(installHandler).catch(() => undefined);
}

export function readNotificationPermission(): Promise<NotificationPermission> {
  return runtime.runPromise(readPermission).catch(() => ({ granted: false }));
}

/** Returns the date it scheduled, or `null` when nothing was. */
export function syncTrainingReminder(reminder: ReminderSchedule, enabled: boolean): Promise<Date | null> {
  return runtime.runPromise(syncReminder(reminder, enabled)).catch(() => null);
}
