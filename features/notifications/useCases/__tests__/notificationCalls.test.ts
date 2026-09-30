import { Effect, Either } from 'effect';
import { itEffect } from '@/features/core/testing';
import { makeNotificationsFake } from '@/features/notifications/useCases/__tests__/notificationsFake';
import { cancelNotification } from '@/features/notifications/useCases/cancelNotification';
import { clearScheduledNotifications } from '@/features/notifications/useCases/clearScheduledNotifications';
import { installNotificationHandler } from '@/features/notifications/useCases/installNotificationHandler';
import {
  askNotificationPermissionOnce,
  openNotificationSettings,
  readNotificationPermission,
  requestNotificationPermission,
} from '@/features/notifications/useCases/readNotificationPermission';
import { sendTestNotification } from '@/features/notifications/useCases/sendTestNotification';

describe('cancelNotification', () => {
  const fake = makeNotificationsFake();
  itEffect(
    'retracts exactly the one notification, and does nothing for null',
    Effect.gen(function* () {
      yield* cancelNotification('id-7');
      yield* cancelNotification(null);
      expect(fake.calls).toEqual(['cancel id-7']);
    }),
    fake.layer,
  );
});

describe('clearScheduledNotifications and installNotificationHandler', () => {
  const fake = makeNotificationsFake();
  itEffect(
    'pass straight through to the scheduler',
    Effect.gen(function* () {
      yield* installNotificationHandler;
      yield* clearScheduledNotifications;
      expect(fake.calls).toEqual(['installHandler', 'cancelAll']);
    }),
    fake.layer,
  );

  const refusing = makeNotificationsFake({ failing: true });
  itEffect(
    'fail with NotificationScheduleFailed when the scheduler refuses',
    Effect.gen(function* () {
      const result = yield* Effect.either(installNotificationHandler);
      expect(Either.isLeft(result) && result.left._tag).toBe('NotificationScheduleFailed');
    }),
    refusing.layer,
  );
});

describe('the permission', () => {
  const fake = makeNotificationsFake({ permission: false, requestAnswer: true });
  itEffect(
    'is read from the device and requested from the system',
    Effect.gen(function* () {
      expect(yield* readNotificationPermission).toEqual({ granted: false, canAsk: false });
      expect(yield* requestNotificationPermission).toEqual({ granted: true, canAsk: false });
    }),
    fake.layer,
  );
});

describe('askNotificationPermissionOnce', () => {
  const undetermined = makeNotificationsFake({ permission: false, canAsk: true, requestAnswer: true });
  itEffect(
    'asks while the system can still show its prompt',
    Effect.gen(function* () {
      expect(yield* askNotificationPermissionOnce).toEqual({
        permission: { granted: true, canAsk: false },
        requested: true,
      });
      expect(undetermined.calls).toEqual(['requestPermission']);
    }),
    undetermined.layer,
  );

  const granted = makeNotificationsFake({ permission: true });
  itEffect(
    'asks nothing when the permission is granted',
    Effect.gen(function* () {
      expect(yield* askNotificationPermissionOnce).toEqual({
        permission: { granted: true, canAsk: false },
        requested: false,
      });
      expect(granted.calls).toEqual([]);
    }),
    granted.layer,
  );

  const refused = makeNotificationsFake({ permission: false, canAsk: false });
  itEffect(
    'asks nothing when the system has refused for good',
    Effect.gen(function* () {
      expect(yield* askNotificationPermissionOnce).toEqual({
        permission: { granted: false, canAsk: false },
        requested: false,
      });
      expect(refused.calls).toEqual([]);
    }),
    refused.layer,
  );
});

describe('openNotificationSettings', () => {
  const fake = makeNotificationsFake();
  itEffect(
    "opens the app's page in the system settings",
    Effect.gen(function* () {
      yield* openNotificationSettings;
      expect(fake.calls).toEqual(['openSettings']);
    }),
    fake.layer,
  );
});

describe('sendTestNotification', () => {
  const fake = makeNotificationsFake();
  itEffect(
    'posts one immediate test alert',
    Effect.gen(function* () {
      expect(yield* sendTestNotification).toBe('id-1');
      expect(fake.scheduled).toHaveLength(1);
      expect(fake.scheduled[0]?.trigger).toBeNull();
    }),
    fake.layer,
  );

  const denied = makeNotificationsFake({ permission: false });
  itEffect(
    'fails with NotificationPermissionDenied without permission',
    Effect.gen(function* () {
      const result = yield* Effect.either(sendTestNotification);
      expect(Either.isLeft(result) && result.left._tag).toBe('NotificationPermissionDenied');
      expect(denied.scheduled).toEqual([]);
    }),
    denied.layer,
  );
});
