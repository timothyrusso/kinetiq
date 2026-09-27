import { Effect, Exit, Layer } from 'effect';
import { SqliteClient, trySql } from '@/features/core/sqlite';
import { WorkoutTransaction } from '@/features/workouts/domain/services/WorkoutTransaction';

/**
 * `BEGIN` and `COMMIT` or `ROLLBACK` on the shared connection, which every repository writes
 * through, so each statement inside is part of the one write. The same statements expo-sqlite's
 * own `withTransactionAsync` runs: a failure anywhere, the commit included, rolls back.
 * Uninterruptible: a screen that unmounts mid-commit must not leave the transaction open.
 */
export const WorkoutTransactionLive = Layer.effect(
  WorkoutTransaction,
  Effect.gen(function* () {
    const db = yield* SqliteClient;
    return {
      atomically: effect =>
        Effect.uninterruptible(
          Effect.gen(function* () {
            yield* trySql('begin a transaction', () => db.execAsync('BEGIN'));
            const exit = yield* Effect.exit(
              Effect.tap(effect, () => trySql('commit a transaction', () => db.execAsync('COMMIT'))),
            );
            if (Exit.isSuccess(exit)) return exit.value;
            yield* trySql('roll back a transaction', () => db.execAsync('ROLLBACK'));
            return yield* exit;
          }),
        ),
    };
  }),
);
