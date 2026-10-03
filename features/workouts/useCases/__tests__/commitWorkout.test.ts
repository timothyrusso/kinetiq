import { Effect, Either } from 'effect';
import { itEffect } from '@/features/core/testing';
import { aCompletedWorkout, anActivity, anEntry, aSet, WORKOUT_TIME } from '@/features/workouts/__fixtures__/builders';
import { ActivityId } from '@/features/workouts/domain/schemas/ActivityId';
import { makeFakeWorkoutsDb, makeWorkoutsFake } from '@/features/workouts/useCases/__tests__/workoutFakes';
import { commitWorkout } from '@/features/workouts/useCases/commitWorkout';

const ENDED = WORKOUT_TIME + 2_700_000;

/** Last week's bench press, at the estimate the builder's sets reach. */
const lastWeek = () =>
  anActivity({ id: ActivityId.make('session-last-week'), startedAt: WORKOUT_TIME - 7 * 86_400_000 });

describe('commitWorkout', () => {
  const fresh = makeFakeWorkoutsDb();
  itEffect(
    'records the workout with the records it set against the history before it',
    Effect.gen(function* () {
      const heavier = aCompletedWorkout({ entries: [anEntry({ sets: [aSet({ weightKg: 110, estimated1rm: 128 })] })] });

      const result = yield* commitWorkout(heavier);

      expect(result.personalRecords.map(record => [record.kind, record.value, record.previousValue])).toEqual([
        ['est1rm', 128, 116.5],
      ]);
      expect(fresh.activities.get('session-mbz1a2b3')?.strength?.personalRecords).toEqual(result.personalRecords);
      expect(fresh.records.get('ex:barbell-bench-press:est1rm')?.value).toBe(128);
    }),
    makeWorkoutsFake(Object.assign(fresh, { activities: new Map([['session-last-week', lastWeek()]]) })),
  );

  const replayed = makeFakeWorkoutsDb();
  itEffect(
    'fails with DuplicateWorkout for a workout already in history, and writes nothing again',
    Effect.gen(function* () {
      yield* commitWorkout(aCompletedWorkout());
      const recordsBefore = new Map(replayed.records);

      const result = yield* Effect.either(commitWorkout(aCompletedWorkout({ title: 'Replayed' })));

      expect(Either.isLeft(result) && result.left._tag).toBe('DuplicateWorkout');
      expect(replayed.activities.get('session-mbz1a2b3')?.title).toBe('Push Day');
      expect(replayed.records).toEqual(recordsBefore);
      expect(replayed.routinesUsed).toHaveLength(1);
    }),
    makeWorkoutsFake(replayed),
  );

  const counted = makeFakeWorkoutsDb();
  itEffect(
    'counts the workout against its routine, at the time it ended',
    Effect.gen(function* () {
      yield* commitWorkout(aCompletedWorkout({ id: ActivityId.make('watch-1'), endedAt: ENDED }));

      expect(counted.routinesUsed).toEqual([{ routineId: 'rtn_push', performedAt: ENDED }]);
    }),
    makeWorkoutsFake(counted),
  );

  const emptied = makeFakeWorkoutsDb();
  itEffect(
    'records a routine workout with no exercises left, and counts nothing against its routine',
    Effect.gen(function* () {
      yield* commitWorkout(aCompletedWorkout({ entries: [], totalSets: 0, totalVolumeKg: 0 }));

      expect(emptied.routinesUsed).toEqual([]);
      expect(emptied.activities.size).toBe(1);
    }),
    makeWorkoutsFake(emptied),
  );

  const unplanned = makeFakeWorkoutsDb();
  itEffect(
    'counts nothing for a workout that came from no routine',
    Effect.gen(function* () {
      yield* commitWorkout(aCompletedWorkout({ routineId: null }));

      expect(unplanned.routinesUsed).toEqual([]);
      expect(unplanned.activities.size).toBe(1);
    }),
    makeWorkoutsFake(unplanned),
  );

  const brokenRecords = makeFakeWorkoutsDb();
  itEffect(
    'writes nothing at all when the records cannot be written',
    Effect.gen(function* () {
      const result = yield* Effect.either(commitWorkout(aCompletedWorkout()));

      expect(Either.isLeft(result) && result.left._tag).toBe('SqlError');
      expect(brokenRecords.activities.size).toBe(0);
      expect(brokenRecords.routinesUsed).toEqual([]);
    }),
    makeWorkoutsFake(brokenRecords, { records: 'upsertBests' }),
  );

  const brokenRoutine = makeFakeWorkoutsDb();
  itEffect(
    'writes neither the workout nor its records when the routine cannot be counted',
    Effect.gen(function* () {
      const result = yield* Effect.either(commitWorkout(aCompletedWorkout()));

      expect(Either.isLeft(result) && result.left._tag).toBe('SqlError');
      expect(brokenRoutine.activities.size).toBe(0);
      expect(brokenRoutine.records.size).toBe(0);
    }),
    makeWorkoutsFake(brokenRoutine, { routineUsage: true }),
  );
});
