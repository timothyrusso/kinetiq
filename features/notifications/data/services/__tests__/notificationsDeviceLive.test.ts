import { Effect } from 'effect';
import { getPermissionsAsync, requestPermissionsAsync, scheduleNotificationAsync } from 'expo-notifications';
import appJson from '@/app.json';
import { itEffect } from '@/features/core/testing';
import { NotificationsDeviceLive } from '@/features/notifications/data/services/notificationsDeviceLive';
import { Notifications } from '@/features/notifications/domain/services/Notifications';

// NOTE: each fake keeps the arity of the real function, since Effect.tryPromise only passes its
// AbortSignal to a `try` that declares a parameter.
jest.mock('expo-notifications', () => ({
  AndroidImportance: { HIGH: 4 },
  PermissionStatus: { GRANTED: 'granted', UNDETERMINED: 'undetermined', DENIED: 'denied' },
  SchedulableTriggerInputTypes: { TIME_INTERVAL: 'timeInterval', DATE: 'date' },
  cancelAllScheduledNotificationsAsync: jest.fn(async () => undefined),
  cancelScheduledNotificationAsync: jest.fn(async () => undefined),
  getPermissionsAsync: jest.fn(async () => ({ granted: false, status: 'undetermined', canAskAgain: true })),
  requestPermissionsAsync: jest.fn(async (_permissions?: unknown) => ({
    granted: true,
    status: 'granted',
    canAskAgain: true,
  })),
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
      expect(yield* notifications.requestPermission).toEqual({ granted: true, canAsk: false });
      expect(requestPermissionsAsync).toHaveBeenCalledTimes(1);
      expect(requestPermissionsAsync).toHaveBeenCalledWith();
    }),
    NotificationsDeviceLive,
  );

  itEffect(
    'reads the permission with no arguments',
    Effect.gen(function* () {
      const notifications = yield* Notifications;
      expect(yield* notifications.permission).toEqual({ granted: false, canAsk: true });
      expect(getPermissionsAsync).toHaveBeenCalledWith();
    }),
    NotificationsDeviceLive,
  );

  itEffect(
    'reads a refusal the system will not ask about again as one it cannot ask',
    Effect.gen(function* () {
      jest.mocked(getPermissionsAsync).mockResolvedValueOnce({
        granted: false,
        status: 'denied',
        canAskAgain: false,
      } as never);
      const notifications = yield* Notifications;
      expect(yield* notifications.permission).toEqual({ granted: false, canAsk: false });
    }),
    NotificationsDeviceLive,
  );

  itEffect(
    'schedules the rest alert on a date trigger in the training channel',
    Effect.gen(function* () {
      const notifications = yield* Notifications;
      const date = new Date(Date.UTC(2026, 8, 30, 7, 27, 26));
      yield* notifications.schedule({
        content: { title: 'Rest complete', body: 'Next set' },
        trigger: { kind: 'at', date },
      });
      expect(scheduleNotificationAsync).toHaveBeenCalledWith({
        content: { sound: 'default', title: 'Rest complete', body: 'Next set' },
        trigger: { type: 'date', date, channelId: 'training' },
      });
    }),
    NotificationsDeviceLive,
  );

  // NOTE: expo-notifications falls back to an inexact alarm, up to a minute or more late, when the
  // app may not set exact ones (#123). The manifest permissions are what let it set them.
  it('declares the Android permissions that make the alarm exact', () => {
    expect(appJson.expo.android.permissions).toEqual(
      expect.arrayContaining(['SCHEDULE_EXACT_ALARM', 'USE_EXACT_ALARM']),
    );
  });
});
