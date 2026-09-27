import { Effect, Layer } from 'effect';
import { Notifications } from '@/features/notifications/domain/services/Notifications';
import { TrainingReminder } from '@/features/notifications/domain/services/TrainingReminder';
import { syncTrainingReminder } from '@/features/notifications/useCases/syncTrainingReminder';

/** `TrainingReminder` over this feature's own use case. */
export const TrainingReminderLive = Layer.effect(
  TrainingReminder,
  Effect.map(Notifications, notifications => ({
    sync: (reminder, enabled) =>
      syncTrainingReminder(reminder, enabled).pipe(Effect.provideService(Notifications, notifications)),
  })),
);
