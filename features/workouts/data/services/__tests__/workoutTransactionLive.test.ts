import { Effect, Either, Layer } from 'effect';
import { SqlError } from '@/features/core/error';
import { SqliteClient } from '@/features/core/sqlite';
import { itEffect, makeMigratedSqliteLayer } from '@/features/core/testing';
import { WorkoutTransactionLive } from '@/features/workouts/data/services/workoutTransactionLive';
import { WorkoutTransaction } from '@/features/workouts/domain/services/WorkoutTransaction';

const layer = () => WorkoutTransactionLive.pipe(Layer.provideMerge(makeMigratedSqliteLayer()));

const insertRecord = (value: number) =>
  Effect.flatMap(SqliteClient, db =>
    Effect.promise(() =>
      db.runAsync(
        `INSERT INTO records (exercise_id, kind, exercise_name, value, achieved_at) VALUES ('ex:barbell-bench-press', 'est1rm', 'Bench Press', ?, 0)
         ON CONFLICT(exercise_id, kind) DO UPDATE SET value = excluded.value`,
        [value],
      ),
    ),
  );

const storedValues = Effect.flatMap(SqliteClient, db =>
  Effect.promise(() => db.getAllAsync<{ value: number }>('SELECT value FROM records')),
).pipe(Effect.map(rows => rows.map(row => row.value)));

describe('WorkoutTransactionLive', () => {
  itEffect(
    'keeps every write of an effect that succeeds',
    Effect.gen(function* () {
      const transaction = yield* WorkoutTransaction;

      const result = yield* transaction.atomically(Effect.as(insertRecord(100), 'done'));

      expect(result).toBe('done');
      expect(yield* storedValues).toEqual([100]);
    }),
    layer(),
  );

  itEffect(
    'rolls back every write of an effect that fails, and fails with its error',
    Effect.gen(function* () {
      const transaction = yield* WorkoutTransaction;
      yield* insertRecord(100);

      const result = yield* Effect.either(
        transaction.atomically(
          insertRecord(120).pipe(Effect.zipRight(Effect.fail(new SqlError({ message: 'the next write failed' })))),
        ),
      );

      expect(Either.isLeft(result) && result.left._tag).toBe('SqlError');
      expect(yield* storedValues).toEqual([100]);
    }),
    layer(),
  );

  itEffect(
    'leaves no transaction open after a rollback',
    Effect.gen(function* () {
      const transaction = yield* WorkoutTransaction;
      yield* Effect.either(transaction.atomically(Effect.fail(new SqlError({ message: 'failed' }))));

      yield* transaction.atomically(insertRecord(90));

      expect(yield* storedValues).toEqual([90]);
    }),
    layer(),
  );
});
