import { Context, type Effect } from 'effect';
import type { ReminderSchedule } from '@/features/notifications/domain/entities/ReminderSchedule';
import type { NotificationScheduleFailed } from '@/features/notifications/domain/errors/NotificationErrors';

/**
 * The weekly training reminder, for the launch: on every launch and every return to the
 * foreground the scheduled reminder is made to match the settings again.
 */
export class TrainingReminder extends Context.Tag('notifications/TrainingReminder')<
  TrainingReminder,
  {
    /** Succeeds with the date it scheduled, or `null` when nothing is scheduled. */
    readonly sync: (
      reminder: ReminderSchedule,
      enabled: boolean,
    ) => Effect.Effect<Date | null, NotificationScheduleFailed>;
  }
>() {}
