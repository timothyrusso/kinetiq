import { runMigrations, SqlError, SqliteClient } from '@timothyrusso/effect-core';
import { Effect, Layer } from 'effect';
import { openAppDatabase } from '@/features/core/sqlite/data/appDatabase';
import { migrations } from '@/features/core/sqlite/data/migrations';

/**
 * The app database, brought to the last schema version when the runtime boots. A failed step
 * rolls back and fails the boot with its `SqlError`, leaving `user_version` at the last step
 * that succeeded.
 */
export const SqliteClientLive = Layer.effect(
  SqliteClient,
  Effect.gen(function* () {
    const db = yield* Effect.tryPromise({
      try: openAppDatabase,
      catch: cause => new SqlError({ message: 'open the app database', cause }),
    });
    yield* runMigrations(db, migrations);
    return db;
  }),
);
