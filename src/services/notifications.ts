/**
 * The imperative calls the legacy callers (bootstrap, the workout screen) still make, run through
 * the app runtime over the `notifications` use cases. A denial degrades, never blocks: every call
 * resolves, with `null` or nothing when a notification could not be posted or retracted, so the
 * rest timer on screen works either way. Goes away when bootstrap (#54) and the workout screen
 * (#53) call the use cases themselves.
 */
import { runtime } from '@/features/core/runtime';
import {
  armRestAlert,
  cancelNotification,
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

/** Returns the scheduled identifier, or `null` when nothing was posted. */
export function notifyRestComplete(exerciseName: string, nextLabel: string, delaySeconds: number): Promise<string | null> {
  return runtime.runPromise(armRestAlert(exerciseName, nextLabel, delaySeconds)).catch(() => null);
}

export function cancelScheduledNotification(identifier: string | null): Promise<void> {
  return runtime.runPromise(cancelNotification(identifier)).catch(() => undefined);
}
