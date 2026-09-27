import { Effect } from 'effect';
import type { NotificationRequest } from '@/features/notifications/domain/entities/NotificationRequest';
import { NotificationPermissionDenied } from '@/features/notifications/domain/errors/NotificationErrors';
import { Notifications } from '@/features/notifications/domain/services/Notifications';

/**
 * Posts `request` when the system allows it, and succeeds with the identifier the scheduler
 * assigned. The identifier is the only handle there is to retract exactly one notification: the
 * scheduler cannot cancel by tag or purpose.
 */
export const postNotification = (request: NotificationRequest) =>
  Effect.gen(function* () {
    const notifications = yield* Notifications;
    const { granted } = yield* notifications.permission;
    if (!granted) return yield* new NotificationPermissionDenied();
    return yield* notifications.schedule(request);
  });
