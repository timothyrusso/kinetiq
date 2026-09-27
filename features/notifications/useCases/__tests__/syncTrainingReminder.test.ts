import { advanceClock } from '@timothyrusso/effect-core/testing';
import { Effect, Either } from 'effect';
import { itEffect } from '@/features/core/testing';
import { makeNotificationsFake } from '@/features/notifications/useCases/__tests__/notificationsFake';
import { syncTrainingReminder } from '@/features/notifications/useCases/syncTrainingReminder';

const reminder = { enabled: true, minuteOfDay: 18 * 60, days: [1, 2, 3, 4, 5, 6, 7] };

describe('syncTrainingReminder', () => {
  const granted = makeNotificationsFake();
  itEffect(
    'cancels what was scheduled, then schedules the next occurrence and returns its date',
    Effect.gen(function* () {
      yield* advanceClock('1 day');
      const next = yield* syncTrainingReminder(reminder, true);
      expect(granted.calls).toEqual(['cancelAll']);
      expect(next).toBeInstanceOf(Date);
      expect(next?.getHours()).toBe(18);
      expect(next?.getMinutes()).toBe(0);
      expect(granted.scheduled).toEqual([
        {
          content: { title: expect.any(String), body: expect.any(String), badge: 1 },
          trigger: { kind: 'at', date: next },
        },
      ]);
    }),
    granted.layer,
  );

  const off = makeNotificationsFake();
  itEffect(
    'only cancels when the master switch or the reminder is off, or no day is picked',
    Effect.gen(function* () {
      expect(yield* syncTrainingReminder(reminder, false)).toBeNull();
      expect(yield* syncTrainingReminder({ ...reminder, enabled: false }, true)).toBeNull();
      expect(yield* syncTrainingReminder({ ...reminder, days: [] }, true)).toBeNull();
      expect(off.calls).toEqual(['cancelAll', 'cancelAll', 'cancelAll']);
      expect(off.scheduled).toEqual([]);
    }),
    off.layer,
  );

  const denied = makeNotificationsFake({ permission: false });
  itEffect(
    'schedules nothing, and does not fail, without permission',
    Effect.gen(function* () {
      expect(yield* syncTrainingReminder(reminder, true)).toBeNull();
      expect(denied.calls).toEqual(['cancelAll']);
      expect(denied.scheduled).toEqual([]);
    }),
    denied.layer,
  );

  const refusing = makeNotificationsFake({ failing: true });
  itEffect(
    'fails with NotificationScheduleFailed when the scheduler refuses to cancel',
    Effect.gen(function* () {
      const result = yield* Effect.either(syncTrainingReminder(reminder, true));
      expect(Either.isLeft(result) && result.left).toMatchObject({
        _tag: 'NotificationScheduleFailed',
        operation: 'cancelAll',
      });
    }),
    refusing.layer,
  );
});
