import { Effect, Either } from 'effect';
import { itEffect } from '@/features/core/testing';
import { makeNotificationsFake } from '@/features/notifications/useCases/__tests__/notificationsFake';
import { armRestAlert } from '@/features/notifications/useCases/armRestAlert';

describe('armRestAlert', () => {
  const granted = makeNotificationsFake();
  itEffect(
    'schedules the alert for the remaining seconds, naming the next set, and returns its id',
    Effect.gen(function* () {
      expect(yield* armRestAlert('Bench Press', 'Set 3 of 4', 42.4)).toBe('id-1');
      expect(granted.scheduled).toEqual([
        {
          content: { title: 'Rest complete', body: expect.stringContaining('Bench Press') },
          trigger: { kind: 'afterSeconds', seconds: 42 },
        },
      ]);
      expect(granted.scheduled[0]?.content.body).toContain('Set 3 of 4');
    }),
    granted.layer,
  );

  const last = makeNotificationsFake();
  itEffect(
    'never schedules less than a second, and words the last set differently',
    Effect.gen(function* () {
      yield* armRestAlert('Bench Press', '', 0.2);
      expect(last.scheduled[0]?.trigger).toEqual({ kind: 'afterSeconds', seconds: 1 });
      expect(last.scheduled[0]?.content.body).not.toContain('undefined');
    }),
    last.layer,
  );

  const denied = makeNotificationsFake({ permission: false });
  itEffect(
    'degrades to a quiet rest, not a failure, without permission',
    Effect.gen(function* () {
      expect(yield* armRestAlert('Bench Press', '', 60)).toBeNull();
      expect(denied.scheduled).toEqual([]);
    }),
    denied.layer,
  );

  const unreadable = makeNotificationsFake({ permission: 'unreadable' });
  itEffect(
    'treats a permission the device cannot report as denied',
    Effect.gen(function* () {
      expect(yield* armRestAlert('Bench Press', '', 60)).toBeNull();
    }),
    unreadable.layer,
  );

  const refusing = makeNotificationsFake({ failing: true });
  itEffect(
    'fails with NotificationScheduleFailed when the scheduler refuses',
    Effect.gen(function* () {
      const result = yield* Effect.either(armRestAlert('Bench Press', '', 60));
      expect(Either.isLeft(result) && result.left).toMatchObject({
        _tag: 'NotificationScheduleFailed',
        operation: 'schedule',
      });
    }),
    refusing.layer,
  );
});
