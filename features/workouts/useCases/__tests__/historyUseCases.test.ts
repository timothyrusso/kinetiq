import { Effect, Either, TestClock } from 'effect';
import { itEffect } from '@/features/core/testing';
import { anActivity, anEntry, aRecord, WORKOUT_TIME } from '@/features/workouts/__fixtures__/builders';
import { ActivityId } from '@/features/workouts/domain/schemas/ActivityId';
import { makeFakeWorkoutsDb, makeWorkoutsFake } from '@/features/workouts/useCases/__tests__/workoutFakes';
import { deleteActivity } from '@/features/workouts/useCases/deleteActivity';
import { exerciseHistory, exerciseRecords } from '@/features/workouts/useCases/exerciseHistory';
import { getActivity } from '@/features/workouts/useCases/getActivity';
import { listActivities } from '@/features/workouts/useCases/listActivities';
import { previousPerformance } from '@/features/workouts/useCases/previousPerformance';
import { trainingGrid, trainingSummary } from '@/features/workouts/useCases/progressStats';
import { recordPersonalRecords } from '@/features/workouts/useCases/recordPersonalRecords';
import { weeklyGoalReached } from '@/features/workouts/useCases/weeklyGoalReached';

const DAY = 86_400_000;
const on = (id: string, startedAt: number) => anActivity({ id: ActivityId.make(id), startedAt });
const history = () =>
  makeFakeWorkoutsDb({
    activities: new Map([
      ['session-old', on('session-old', WORKOUT_TIME - 30 * DAY)],
      ['session-new', on('session-new', WORKOUT_TIME)],
    ]),
  });

describe('listActivities', () => {
  itEffect(
    'lists every workout, newest first',
    Effect.gen(function* () {
      expect((yield* listActivities).map(activity => activity.id)).toEqual(['session-new', 'session-old']);
    }),
    makeWorkoutsFake(history()),
  );

  itEffect(
    'fails with SqlError when the history cannot be read',
    Effect.gen(function* () {
      const result = yield* Effect.either(listActivities);

      expect(Either.isLeft(result) && result.left._tag).toBe('SqlError');
    }),
    makeWorkoutsFake(history(), { activities: 'list' }),
  );
});

describe('getActivity', () => {
  itEffect(
    'reads one workout',
    Effect.gen(function* () {
      expect((yield* getActivity(ActivityId.make('session-new'))).startedAt).toBe(WORKOUT_TIME);
    }),
    makeWorkoutsFake(history()),
  );

  itEffect(
    'fails with ActivityNotFound for a workout that is gone',
    Effect.gen(function* () {
      const result = yield* Effect.either(getActivity(ActivityId.make('session-gone')));

      expect(Either.isLeft(result) && result.left._tag).toBe('ActivityNotFound');
    }),
    makeWorkoutsFake(history()),
  );
});

describe('deleteActivity', () => {
  const db = history();
  itEffect(
    'deletes the workout and leaves the others',
    Effect.gen(function* () {
      yield* deleteActivity(ActivityId.make('session-old'));

      expect([...db.activities.keys()]).toEqual(['session-new']);
    }),
    makeWorkoutsFake(db),
  );

  const kept = history();
  itEffect(
    'fails with SqlError when the delete fails, keeping the workout',
    Effect.gen(function* () {
      const result = yield* Effect.either(deleteActivity(ActivityId.make('session-old')));

      expect(Either.isLeft(result) && result.left._tag).toBe('SqlError');
      expect(kept.activities.size).toBe(2);
    }),
    makeWorkoutsFake(kept, { activities: 'remove' }),
  );
});

describe('exerciseHistory and exerciseRecords', () => {
  itEffect(
    'summarises every workout of the exercise',
    Effect.gen(function* () {
      const summary = yield* exerciseHistory('ex:barbell-bench-press');

      expect(summary.sessionsCount).toBe(2);
      expect(summary.lastPerformedAt).toBe(WORKOUT_TIME);
    }),
    makeWorkoutsFake(history()),
  );

  itEffect(
    'reads the records held for the exercise',
    Effect.gen(function* () {
      expect(yield* exerciseRecords('ex:barbell-bench-press')).toEqual([aRecord()]);
    }),
    makeWorkoutsFake(makeFakeWorkoutsDb({ records: new Map([['ex:barbell-bench-press:est1rm', aRecord()]]) })),
  );
});

describe('recordPersonalRecords', () => {
  const db = makeFakeWorkoutsDb();
  itEffect(
    'keeps the records a workout set',
    Effect.gen(function* () {
      yield* recordPersonalRecords([aRecord()]);

      expect([...db.records.values()]).toEqual([aRecord()]);
    }),
    makeWorkoutsFake(db),
  );
});

describe('previousPerformance', () => {
  itEffect(
    'reads what was lifted last time on each exercise asked for',
    Effect.gen(function* () {
      const previous = yield* previousPerformance(['ex:barbell-bench-press']);

      expect(previous.get('ex:barbell-bench-press')?.performedAt).toBe(WORKOUT_TIME);
    }),
    makeWorkoutsFake(history()),
  );

  itEffect(
    'knows nothing of an exercise never trained',
    Effect.gen(function* () {
      expect((yield* previousPerformance(['ex:retired-exercise'])).size).toBe(0);
    }),
    makeWorkoutsFake(
      makeFakeWorkoutsDb({
        activities: new Map([
          [
            'a',
            anActivity({ strength: { entries: [anEntry()], totalVolumeKg: 1000, totalSets: 2, personalRecords: [] } }),
          ],
        ]),
      }),
    ),
  );
});

describe('trainingSummary and trainingGrid', () => {
  itEffect(
    'summarises the window ending today and knows there is older history',
    Effect.gen(function* () {
      yield* TestClock.setTime(WORKOUT_TIME + 3_600_000);

      const summary = yield* trainingSummary(1);

      expect(summary.totals.workouts).toBe(1);
      expect(summary.hasAnyHistory).toBe(true);
      expect(summary.weeks).toHaveLength(1);
    }),
    makeWorkoutsFake(history()),
  );

  itEffect(
    'puts this week’s minutes on the grid',
    Effect.gen(function* () {
      yield* TestClock.setTime(WORKOUT_TIME + 3_600_000);

      const grid = yield* trainingGrid(1);

      expect(grid.workouts).toBe(1);
      expect(grid.days[0]?.value).toBe(45);
    }),
    makeWorkoutsFake(history()),
  );
});

describe('weeklyGoalReached', () => {
  itEffect(
    'is true when this week’s workouts are exactly the goal',
    Effect.gen(function* () {
      expect(yield* weeklyGoalReached(1, WORKOUT_TIME + 3_600_000)).toBe(true);
    }),
    makeWorkoutsFake(history()),
  );

  itEffect(
    'is false past the goal: only the workout that met it counts',
    Effect.gen(function* () {
      expect(yield* weeklyGoalReached(0, WORKOUT_TIME + 3_600_000)).toBe(false);
    }),
    makeWorkoutsFake(history()),
  );

  itEffect(
    'falls back to false when the history cannot be read',
    Effect.gen(function* () {
      expect(yield* weeklyGoalReached(1, WORKOUT_TIME + 3_600_000)).toBe(false);
    }),
    makeWorkoutsFake(history(), { activities: 'list' }),
  );
});
