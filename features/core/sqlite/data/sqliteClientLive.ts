import { type Migration, runMigrations, SqlError, SqliteClient, type SqliteDatabase } from '@timothyrusso/effect-core';
import { Context, Effect, Layer, Ref } from 'effect';
import { openAppDatabase } from '@/features/core/sqlite/data/appDatabase';
import { migrations } from '@/features/core/sqlite/data/migrations';
import { type SchemaReport, SchemaStatus } from '@/features/core/sqlite/domain/services/SchemaStatus';

const userVersion = (db: SqliteDatabase) =>
  Effect.tryPromise({
    try: () => db.getFirstAsync<{ user_version: number }>('PRAGMA user_version'),
    catch: cause => new SqlError({ message: 'read the schema version', cause }),
  }).pipe(Effect.map(row => row?.user_version ?? 0));

/**
 * Brings `db` to the last version of `steps` and reports what happened. A failed step rolls back,
 * leaves `user_version` at the last step that succeeded and is reported, not raised: the
 * connection is still a working database on the schema it has.
 */
export const migrateReporting = (db: SqliteDatabase, steps: readonly Migration[] = migrations) =>
  Effect.gen(function* () {
    const fromVersion = yield* userVersion(db);
    const migrated = yield* Effect.either(runMigrations(db, steps));
    const toVersion = yield* userVersion(db);
    const report: SchemaReport = {
      fromVersion,
      toVersion,
      migrationError: migrated._tag === 'Left' ? migrated.left : null,
    };
    return report;
  });

/**
 * The app database, brought to the last schema version when the runtime boots, and the
 * `SchemaStatus` of that launch. Only a database that cannot be opened fails the boot: a failed
 * migration is the bootstrap's to show, over a connection that can still erase the data and run
 * the migrations again.
 */
export const SqliteClientLive = Layer.effectContext(
  Effect.gen(function* () {
    const db = yield* Effect.tryPromise({
      try: () => openAppDatabase(),
      catch: cause => new SqlError({ message: 'open the app database', cause }),
    });
    const last = yield* Ref.make(yield* migrateReporting(db));
    const status = SchemaStatus.of({
      current: Ref.get(last),
      remigrate: migrateReporting(db).pipe(Effect.tap(report => Ref.set(last, report))),
    });
    return Context.make(SqliteClient, db).pipe(Context.add(SchemaStatus, status));
  }),
);
