import { Effect } from 'effect';
import { Notifications } from '@/features/notifications/domain/services/Notifications';

/**
 * Retracts the one scheduled notification `identifier` names; `null`, which is what "nothing was
 * armed" looks like, does nothing. Retracting everything instead would take the weekly training
 * reminder down with a rest alert.
 */
export const cancelNotification = (identifier: string | null) =>
  identifier === null ? Effect.void : Effect.flatMap(Notifications, notifications => notifications.cancel(identifier));
