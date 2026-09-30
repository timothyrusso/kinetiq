import { Context, type Effect } from 'effect';
import type { UnexpectedError } from '@/features/core/error';
import type { NotificationPermission } from '@/features/notifications/domain/entities/NotificationPermission';
import type { NotificationRequest } from '@/features/notifications/domain/entities/NotificationRequest';
import type {
  NotificationPermissionDenied,
  NotificationScheduleFailed,
} from '@/features/notifications/domain/errors/NotificationErrors';

/**
 * Local notifications on the device. A thin capability: what to post and when is the use cases'
 * decision.
 */
export class Notifications extends Context.Tag('notifications/Notifications')<
  Notifications,
  {
    /** The permission as the device reports it now; a device that cannot say fails. */
    readonly permission: Effect.Effect<NotificationPermission, NotificationPermissionDenied>;
    /** Asks the system, which may show its prompt once and then only ever answer. */
    readonly requestPermission: Effect.Effect<NotificationPermission, NotificationPermissionDenied>;
    /** Opens the app's page in the system settings, the only place a refusal can be undone. */
    readonly openSettings: Effect.Effect<void, UnexpectedError>;
    /** Posts `request` and succeeds with the identifier the scheduler assigned. */
    readonly schedule: (request: NotificationRequest) => Effect.Effect<string, NotificationScheduleFailed>;
    /** Retracts the one scheduled notification `identifier` names. */
    readonly cancel: (identifier: string) => Effect.Effect<void, NotificationScheduleFailed>;
    /** Retracts everything this app scheduled: the scheduler cannot cancel by purpose. */
    readonly cancelAll: Effect.Effect<void, NotificationScheduleFailed>;
    /** Makes a notification arriving while the app is open show, once per launch. */
    readonly installHandler: Effect.Effect<void, NotificationScheduleFailed>;
  }
>() {}
