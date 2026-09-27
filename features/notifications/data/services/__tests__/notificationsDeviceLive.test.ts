import { Effect } from 'effect';
import { getPermissionsAsync, requestPermissionsAsync } from 'expo-notifications';
import { itEffect } from '@/features/core/testing';
import { NotificationsDeviceLive } from '@/features/notifications/data/services/notificationsDeviceLive';
import { Notifications } from '@/features/notifications/domain/services/Notifications';

// NOTE: each fake keeps the arity of the real function, since Effect.tryPromise only passes its
// AbortSignal to a `try` that declares a parameter.
jest.mock('expo-notifications', () => ({
  AndroidImportance: { HIGH: 4 },
  SchedulableTriggerInputTypes: { TIME_INTERVAL: 'timeInterval', DATE: 'date' },
  cancelAllScheduledNotificationsAsync: jest.fn(async () => undefined),
  cancelScheduledNotificationAsync: jest.fn(async () => undefined),
  getPermissionsAsync: jest.fn(async () => ({ granted: false })),
  requestPermissionsAsync: jest.fn(async (_permissions?: unknown) => ({ granted: true })),
  scheduleNotificationAsync: jest.fn(async () => 'id'),
  setNotificationChannelAsync: jest.fn(async () => null),
  setNotificationHandler: jest.fn(),
}));

beforeEach(() => jest.clearAllMocks());

// NOTE: Effect.tryPromise hands its `try` an AbortSignal. A native function passed by reference
// takes that signal as its first argument: `requestPermissionsAsync` read it as the requested
// permissions and iOS never showed the prompt (#73).
describe('NotificationsDeviceLive', () => {
  itEffect(
    'asks the system for permission with no arguments',
    Effect.gen(function* () {
      const notifications = yield* Notifications;
      expect(yield* notifications.requestPermission).toEqual({ granted: true });
      expect(requestPermissionsAsync).toHaveBeenCalledTimes(1);
      expect(requestPermissionsAsync).toHaveBeenCalledWith();
    }),
    NotificationsDeviceLive,
  );

  itEffect(
    'reads the permission with no arguments',
    Effect.gen(function* () {
      const notifications = yield* Notifications;
      expect(yield* notifications.permission).toEqual({ granted: false });
      expect(getPermissionsAsync).toHaveBeenCalledWith();
    }),
    NotificationsDeviceLive,
  );
});
