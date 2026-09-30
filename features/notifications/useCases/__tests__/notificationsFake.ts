import { Effect, Layer } from 'effect';
import type { NotificationRequest } from '@/features/notifications/domain/entities/NotificationRequest';
import {
  NotificationPermissionDenied,
  NotificationScheduleFailed,
} from '@/features/notifications/domain/errors/NotificationErrors';
import { Notifications } from '@/features/notifications/domain/services/Notifications';

interface FakeOptions {
  /** What the device answers; `'unreadable'` fails the read. */
  readonly permission?: boolean | 'unreadable';
  /** The system would still show its prompt. */
  readonly canAsk?: boolean;
  /** What a permission request answers. */
  readonly requestAnswer?: boolean;
  /** The scheduler refuses every call. */
  readonly failing?: boolean;
  /** The scheduler refuses only to cancel everything. */
  readonly refusingCancelAll?: boolean;
}

/** A `Notifications` that records what it was asked to do instead of posting anything. */
export const makeNotificationsFake = ({
  permission = true,
  canAsk = false,
  requestAnswer = true,
  failing = false,
  refusingCancelAll = false,
}: FakeOptions = {}) => {
  const scheduled: NotificationRequest[] = [];
  const calls: string[] = [];
  const refuse = (operation: 'schedule' | 'cancel' | 'cancelAll' | 'installHandler') =>
    Effect.fail(new NotificationScheduleFailed({ operation }));
  const layer = Layer.succeed(Notifications, {
    permission:
      permission === 'unreadable'
        ? Effect.fail(new NotificationPermissionDenied())
        : Effect.succeed({ granted: permission, canAsk }),
    requestPermission: Effect.sync(() => {
      calls.push('requestPermission');
      return { granted: requestAnswer, canAsk: false };
    }),
    openSettings: Effect.sync(() => void calls.push('openSettings')),
    schedule: request =>
      failing
        ? refuse('schedule')
        : Effect.sync(() => {
            scheduled.push(request);
            return `id-${scheduled.length}`;
          }),
    cancel: identifier => (failing ? refuse('cancel') : Effect.sync(() => void calls.push(`cancel ${identifier}`))),
    cancelAll: failing || refusingCancelAll ? refuse('cancelAll') : Effect.sync(() => void calls.push('cancelAll')),
    installHandler: failing ? refuse('installHandler') : Effect.sync(() => void calls.push('installHandler')),
  });
  return { layer, scheduled: scheduled as readonly NotificationRequest[], calls: calls as readonly string[] };
};
