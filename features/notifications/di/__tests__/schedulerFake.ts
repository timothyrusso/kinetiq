import { Effect, Layer } from 'effect';
import type { NotificationRequest } from '@/features/notifications/domain/entities/NotificationRequest';
import {
  NotificationPermissionDenied,
  NotificationScheduleFailed,
} from '@/features/notifications/domain/errors/NotificationErrors';
import { Notifications } from '@/features/notifications/domain/services/Notifications';

/** The device's scheduler as a test sets it up and reads it back. */
interface SchedulerDevice {
  /** What the device answers now; `'unreadable'` fails the read. */
  permission: boolean | 'unreadable';
  /** The system would still show its prompt; a request answers it and it cannot ask again. */
  canAsk: boolean;
  /** What the next permission request answers, and becomes. */
  answer: boolean;
  /** How many times the permission was requested. */
  requests: number;
  /** How many times the system settings were opened. */
  settingsOpened: number;
  /** The scheduler refuses to post. */
  refuseSchedule: boolean;
  /** What is scheduled, by identifier. */
  readonly pending: Map<string, NotificationRequest>;
}

/**
 * A `Notifications` over a scheduler that holds what is pending, for the facade and screen tests:
 * `cancel` and `cancelAll` remove from it, so a test asserts what is left rather than what was
 * called. `reset` puts the device back to granted, answering yes, with nothing pending and
 * nothing asked.
 */
export const makeSchedulerFake = () => {
  const device: SchedulerDevice = {
    permission: true,
    canAsk: false,
    answer: true,
    requests: 0,
    settingsOpened: 0,
    refuseSchedule: false,
    pending: new Map(),
  };
  let next = 0;
  const layer = Layer.succeed(Notifications, {
    permission: Effect.suspend(() =>
      device.permission === 'unreadable'
        ? Effect.fail(new NotificationPermissionDenied())
        : Effect.succeed({ granted: device.permission, canAsk: device.canAsk }),
    ),
    requestPermission: Effect.sync(() => {
      device.requests += 1;
      device.permission = device.answer;
      device.canAsk = false;
      return { granted: device.answer, canAsk: false };
    }),
    openSettings: Effect.sync(() => {
      device.settingsOpened += 1;
    }),
    schedule: request =>
      Effect.suspend(() => {
        if (device.refuseSchedule) return Effect.fail(new NotificationScheduleFailed({ operation: 'schedule' }));
        next += 1;
        device.pending.set(`n${next}`, request);
        return Effect.succeed(`n${next}`);
      }),
    cancel: identifier => Effect.sync(() => void device.pending.delete(identifier)),
    cancelAll: Effect.sync(() => device.pending.clear()),
    installHandler: Effect.void,
  });
  const reset = () => {
    device.permission = true;
    device.canAsk = false;
    device.answer = true;
    device.requests = 0;
    device.settingsOpened = 0;
    device.refuseSchedule = false;
    device.pending.clear();
    next = 0;
  };
  return { layer, device, reset };
};
