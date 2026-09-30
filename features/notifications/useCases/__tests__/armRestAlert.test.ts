import { Effect, Either } from 'effect';
import { itEffect } from '@/features/core/testing';
import { makeNotificationsFake } from '@/features/notifications/useCases/__tests__/notificationsFake';
import { armRestAlert } from '@/features/notifications/useCases/armRestAlert';

describe('armRestAlert', () => {
  const nextSet = makeNotificationsFake();
  itEffect(
    'schedules the alert for the remaining seconds, naming the next set of an unfinished exercise',
    Effect.gen(function* () {
      expect(yield* armRestAlert('Bench Press', { kind: 'set', set: 3, total: 4 }, 42.4)).toBe('id-1');
      expect(nextSet.scheduled).toEqual([
        {
          content: { title: 'Rest complete', body: 'Next up: Bench Press, set 3 of 4.' },
          trigger: { kind: 'afterSeconds', seconds: 42 },
        },
      ]);
    }),
    nextSet.layer,
  );

  const nextExercise = makeNotificationsFake();
  itEffect(
    'says a finished exercise is done and names the next one',
    Effect.gen(function* () {
      yield* armRestAlert('Bench Press', { kind: 'exercise', name: 'Squat' }, 60);
      expect(nextExercise.scheduled[0]?.content.body).toBe('Bench Press is done. Next up: Squat.');
    }),
    nextExercise.layer,
  );

  const last = makeNotificationsFake();
  itEffect(
    'never schedules less than a second, and says so when nothing is left',
    Effect.gen(function* () {
      yield* armRestAlert('Bench Press', { kind: 'none' }, 0.2);
      expect(last.scheduled[0]?.trigger).toEqual({ kind: 'afterSeconds', seconds: 1 });
      expect(last.scheduled[0]?.content.body).toBe('Bench Press is done: you are finished here.');
    }),
    last.layer,
  );

  const denied = makeNotificationsFake({ permission: false });
  itEffect(
    'degrades to a quiet rest, not a failure, without permission',
    Effect.gen(function* () {
      expect(yield* armRestAlert('Bench Press', { kind: 'none' }, 60)).toBeNull();
      expect(denied.scheduled).toEqual([]);
    }),
    denied.layer,
  );

  const unreadable = makeNotificationsFake({ permission: 'unreadable' });
  itEffect(
    'treats a permission the device cannot report as denied',
    Effect.gen(function* () {
      expect(yield* armRestAlert('Bench Press', { kind: 'none' }, 60)).toBeNull();
    }),
    unreadable.layer,
  );

  const refusing = makeNotificationsFake({ failing: true });
  itEffect(
    'fails with NotificationScheduleFailed when the scheduler refuses',
    Effect.gen(function* () {
      const result = yield* Effect.either(armRestAlert('Bench Press', { kind: 'none' }, 60));
      expect(Either.isLeft(result) && result.left).toMatchObject({
        _tag: 'NotificationScheduleFailed',
        operation: 'schedule',
      });
    }),
    refusing.layer,
  );
});
