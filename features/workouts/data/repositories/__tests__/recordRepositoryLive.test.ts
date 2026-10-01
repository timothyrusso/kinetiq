import { Effect, Layer } from 'effect';
import { itEffect, makeMigratedSqliteLayer } from '@/features/core/testing';
import { aRecord, WORKOUT_TIME } from '@/features/workouts/__fixtures__/builders';
import { RecordRepositoryLive } from '@/features/workouts/data/repositories/recordRepositoryLive';
import { RecordRepository } from '@/features/workouts/domain/repositories/RecordRepository';

const layer = () => RecordRepositoryLive.pipe(Layer.provideMerge(makeMigratedSqliteLayer()));

describe('RecordRepositoryLive', () => {
  itEffect(
    'keeps a first record and reads it back with no previous value',
    Effect.gen(function* () {
      const repository = yield* RecordRepository;

      yield* repository.upsertBests([aRecord({ previousValue: 100 })]);

      expect(yield* repository.forExercise('ex:barbell-bench-press')).toEqual([aRecord()]);
    }),
    layer(),
  );

  itEffect(
    'replaces the best with a higher value',
    Effect.gen(function* () {
      const repository = yield* RecordRepository;
      yield* repository.upsertBests([aRecord()]);

      yield* repository.upsertBests([aRecord({ value: 120, achievedAt: WORKOUT_TIME + 1 })]);

      expect((yield* repository.forExercise('ex:barbell-bench-press')).map(record => record.value)).toEqual([120]);
    }),
    layer(),
  );

  itEffect(
    'never downgrades a best when an older, lighter workout is replayed',
    Effect.gen(function* () {
      const repository = yield* RecordRepository;
      yield* repository.upsertBests([aRecord({ value: 120 })]);

      yield* repository.upsertBests([aRecord({ value: 110, achievedAt: WORKOUT_TIME + 1 })]);

      expect(yield* repository.forExercise('ex:barbell-bench-press')).toEqual([aRecord({ value: 120 })]);
    }),
    layer(),
  );

  itEffect(
    'moves an equal best to the more recent date only',
    Effect.gen(function* () {
      const repository = yield* RecordRepository;
      yield* repository.upsertBests([aRecord()]);

      yield* repository.upsertBests([aRecord({ achievedAt: WORKOUT_TIME + 5 })]);
      yield* repository.upsertBests([aRecord({ achievedAt: WORKOUT_TIME - 5 })]);

      expect((yield* repository.forExercise('ex:barbell-bench-press')).map(record => record.achievedAt)).toEqual([
        WORKOUT_TIME + 5,
      ]);
    }),
    layer(),
  );

  itEffect(
    'keeps one best per kind, and reads only the exercise asked for',
    Effect.gen(function* () {
      const repository = yield* RecordRepository;

      yield* repository.upsertBests([
        aRecord(),
        aRecord({ kind: 'maxReps', value: 10 }),
        aRecord({ exerciseId: 'ex:barbell-squat', exerciseName: 'Overhead Press', value: 60 }),
      ]);

      expect((yield* repository.forExercise('ex:barbell-bench-press')).map(record => record.kind)).toEqual([
        'est1rm',
        'maxReps',
      ]);
    }),
    layer(),
  );
});
