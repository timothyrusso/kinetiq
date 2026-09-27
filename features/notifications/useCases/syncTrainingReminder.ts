import { Clock, Effect, Either } from 'effect';
import { tr } from '@/features/core/translations';
import type { ReminderSchedule } from '@/features/notifications/domain/entities/ReminderSchedule';
import { Notifications } from '@/features/notifications/domain/services/Notifications';
import { nextReminderDate } from '@/features/notifications/domain/utils/nextReminderDate';
import { postNotification } from '@/features/notifications/useCases/postNotification';

/**
 * Makes the scheduled reminder match the settings, and succeeds with the date it scheduled, or
 * `null` when nothing is scheduled: switched off, no day picked, or no permission, which is a
 * normal state for a device and not a failure.
 *
 * The reminder is re-scheduled rather than registered with a recurrence rule: iOS gives no way
 * to observe whether a scheduled notification fired, so a repeating trigger and a settings
 * change can drift. Cancelling, then scheduling the next single occurrence on launch, on return
 * to the foreground and on every settings change keeps what is scheduled equal to what the user
 * asked for. The cancel cannot be selective, so it also sweeps an armed rest alert: the settings
 * screen does not call this mid-workout for that reason.
 *
 * A cancel that fails does not stop the schedule, as on `main`: a reminder the user asked for is
 * worth the risk of a stale one beside it. The cancel's `NotificationScheduleFailed` is then the
 * result, once the new reminder is scheduled, so the boundary still logs it.
 */
export const syncTrainingReminder = (reminder: ReminderSchedule, enabled: boolean) =>
  Effect.gen(function* () {
    const notifications = yield* Notifications;
    const cancelled = yield* Effect.either(notifications.cancelAll);
    const next = enabled ? nextReminderDate(reminder, new Date(yield* Clock.currentTimeMillis)) : null;
    if (next !== null) {
      yield* postNotification({
        content: { title: tr('push.reminderTitle'), body: tr('push.reminderBody'), badge: 1 },
        trigger: { kind: 'at', date: next },
      });
    }
    if (Either.isLeft(cancelled)) return yield* cancelled.left;
    return next;
  }).pipe(Effect.catchTag('NotificationPermissionDenied', () => Effect.succeed(null)));
