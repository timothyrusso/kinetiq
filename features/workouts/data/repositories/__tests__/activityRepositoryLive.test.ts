import { Effect, Either, Layer } from 'effect';
import { SqliteClient } from '@/features/core/sqlite';
import { itEffect, makeMigratedSqliteLayer } from '@/features/core/testing';
import { aCompletedWorkout, anEntry, aRecord, aSet, WORKOUT_TIME } from '@/features/workouts/__fixtures__/builders';
import { ActivityRepositoryLive } from '@/features/workouts/data/repositories/activityRepositoryLive';
import { ActivityRepository } from '@/features/workouts/domain/repositories/ActivityRepository';
import { ActivityId } from '@/features/workouts/domain/schemas/ActivityId';

const layer = () => ActivityRepositoryLive.pipe(Layer.provideMerge(makeMigratedSqliteLayer()));

const DAY = 86_400_000;

const run = (sql: string, params: (string | number | null)[] = []) =>
  Effect.flatMap(SqliteClient, db => Effect.promise(() => db.runAsync(sql, params)));

/** Three workouts a day apart, recorded oldest first. */
const recordThree = Effect.gen(function* () {
  const repository = yield* ActivityRepository;
  for (const [index, id] of ['session-a', 'session-b', 'session-c'].entries()) {
    yield* repository.recordWorkout(
      aCompletedWorkout({ id: ActivityId.make(id), startedAt: WORKOUT_TIME + index * DAY }),
      [],
    );
  }
  return repository;
});

describe('ActivityRepositoryLive recordWorkout', () => {
  itEffect(
    'records a workout and reads it back with its totals derived from the entries',
    Effect.gen(function* () {
      const repository = yield* ActivityRepository;
      const entries = [anEntry({ sets: [aSet(), aSet({ index: 1, completed: false })] })];

      yield* repository.recordWorkout(aCompletedWorkout({ entries, totalVolumeKg: 9999, totalSets: 9 }), [aRecord()]);

      const stored = yield* repository.byId(ActivityId.make('session-mbz1a2b3'));
      expect(stored).toEqual({
        id: 'session-mbz1a2b3',
        kind: 'lift',
        title: 'Push Day',
        startedAt: WORKOUT_TIME,
        durationSeconds: 2700,
        notes: null,
        sourceSessionId: 'session-mbz1a2b3',
        strength: { entries, totalVolumeKg: 500, totalSets: 1, personalRecords: [] },
      });
    }),
    layer(),
  );

  itEffect(
    'stores a blank title as Strength session',
    Effect.gen(function* () {
      const repository = yield* ActivityRepository;

      const activity = yield* repository.recordWorkout(aCompletedWorkout({ title: '   ' }), []);

      expect(activity.title).toBe('Strength session');
      expect((yield* repository.byId(activity.id))?.title).toBe('Strength session');
    }),
    layer(),
  );

  itEffect(
    'returns the records the workout set with the activity it wrote',
    Effect.gen(function* () {
      const activity = yield* (yield* ActivityRepository).recordWorkout(aCompletedWorkout(), [aRecord()]);

      expect(activity.strength?.personalRecords).toEqual([aRecord()]);
    }),
    layer(),
  );
});

describe('ActivityRepositoryLive reads', () => {
  itEffect(
    'lists newest first by default, and oldest first on request',
    Effect.gen(function* () {
      const repository = yield* recordThree;

      expect((yield* repository.list()).map(activity => activity.id)).toEqual(['session-c', 'session-b', 'session-a']);
      expect((yield* repository.list({ order: 'asc' })).map(activity => activity.id)).toEqual([
        'session-a',
        'session-b',
        'session-c',
      ]);
    }),
    layer(),
  );

  itEffect(
    'bounds the list by start time, limit and offset',
    Effect.gen(function* () {
      const repository = yield* recordThree;

      const fromSecond = yield* repository.list({ from: WORKOUT_TIME + DAY });
      const toSecond = yield* repository.list({ to: WORKOUT_TIME + DAY });
      const page = yield* repository.list({ limit: 1, offset: 1 });

      expect(fromSecond.map(activity => activity.id)).toEqual(['session-c', 'session-b']);
      expect(toSecond.map(activity => activity.id)).toEqual(['session-b', 'session-a']);
      expect(page.map(activity => activity.id)).toEqual(['session-b']);
    }),
    layer(),
  );

  itEffect(
    'counts the workouts without reading them',
    Effect.gen(function* () {
      const repository = yield* recordThree;

      expect(yield* repository.count).toBe(3);
    }),
    layer(),
  );

  itEffect(
    'counts zero on an empty history',
    Effect.gen(function* () {
      expect(yield* (yield* ActivityRepository).count).toBe(0);
    }),
    layer(),
  );

  itEffect(
    'reads nothing for an id that is not stored',
    Effect.gen(function* () {
      expect(yield* (yield* ActivityRepository).byId(ActivityId.make('session-gone'))).toBeUndefined();
    }),
    layer(),
  );

  itEffect(
    'deletes a workout',
    Effect.gen(function* () {
      const repository = yield* recordThree;

      yield* repository.remove(ActivityId.make('session-b'));

      expect((yield* repository.list()).map(activity => activity.id)).toEqual(['session-c', 'session-a']);
    }),
    layer(),
  );

  itEffect(
    'reads a row whose sets do not parse with no entries, rather than failing the history',
    Effect.gen(function* () {
      const repository = yield* recordThree;
      yield* run(`UPDATE activities SET entries_json = '{not json' WHERE id = 'session-a'`);

      const damaged = yield* repository.byId(ActivityId.make('session-a'));

      expect(damaged?.strength?.entries).toEqual([]);
      expect(yield* repository.list()).toHaveLength(3);
    }),
    layer(),
  );

  itEffect(
    'reads a row with no volume as a workout without strength data',
    Effect.gen(function* () {
      const repository = yield* recordThree;
      yield* run(`UPDATE activities SET volume_kg = NULL WHERE id = 'session-a'`);

      expect((yield* repository.byId(ActivityId.make('session-a')))?.strength).toBeNull();
    }),
    layer(),
  );

  itEffect(
    'fails with DecodeError on a row whose id is empty',
    Effect.gen(function* () {
      const repository = yield* recordThree;
      yield* run(`UPDATE activities SET id = '' WHERE id = 'session-a'`);

      const result = yield* Effect.either(repository.list());

      expect(Either.isLeft(result) && result.left._tag).toBe('DecodeError');
    }),
    layer(),
  );
});
