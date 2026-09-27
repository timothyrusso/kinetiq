import { useEffectMutation } from '@/features/core/query';
import type { ReminderSchedule } from '@/features/notifications/domain/entities/ReminderSchedule';
import { clearScheduledNotifications } from '@/features/notifications/useCases/clearScheduledNotifications';
import { sendTestNotification } from '@/features/notifications/useCases/sendTestNotification';
import { syncTrainingReminder } from '@/features/notifications/useCases/syncTrainingReminder';

interface ReminderSync {
  readonly reminder: ReminderSchedule;
  readonly enabled: boolean;
}

/**
 * What the notifications settings do to the device: rebuild the reminder schedule, clear it, or
 * post a test. Fired and forgotten: each failure is logged once at the boundary, and the screen
 * has nothing to add to it.
 */
export function useReminderSchedule() {
  const sync = useEffectMutation({
    mutationFn: ({ reminder, enabled }: ReminderSync) => syncTrainingReminder(reminder, enabled),
  });
  const clear = useEffectMutation({ mutationFn: () => clearScheduledNotifications });
  const test = useEffectMutation({ mutationFn: () => sendTestNotification });
  return { sync: sync.mutate, clear: clear.mutate, sendTest: test.mutate };
}
