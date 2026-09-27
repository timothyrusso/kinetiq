import { runMigrations } from '@timothyrusso/effect-core';
import { Effect, Either, Layer, Ref } from 'effect';
import { migrations, type SchemaReport, SchemaStatus, SqliteClient, type SqliteDatabase } from '@/features/core/sqlite';
import { resetLocalData } from '@/features/core/sqlite/useCases/resetLocalData';
import { itEffect, makeNodeSqliteLayer } from '@/features/core/testing';

/** A step past the app's last one that cannot pass while two routines share a name. */
const UNIQUE_NAMES = { version: 11, up: 'CREATE UNIQUE INDEX idx_routines_name ON routines (name);' };

const countOf = (table: string) =>
  Effect.flatMap(SqliteClient, db =>
    Effect.promise(() => db.getFirstAsync<{ n: number }>(`SELECT COUNT(*) AS n FROM ${table}`)),
  ).pipe(Effect.map(row => row?.n ?? 0));

describe('resetLocalData', () => {
  itEffect(
    'erases the data a migration failed on and runs the migrations again to the last version',
    Effect.gen(function* () {
      const status = yield* SchemaStatus;
      expect((yield* status.current).migrationError?._tag).toBe('SqlError');

      const report = yield* resetLocalData;

      expect(report).toEqual({ fromVersion: 10, toVersion: 11, migrationError: null });
      expect(yield* status.current).toEqual(report);
      expect(yield* countOf('routines')).toBe(0);
    }),
    blockedAtVersion10(),
  );

  itEffect(
    'keeps the exercise catalog through the reset',
    Effect.gen(function* () {
      yield* resetLocalData;

      expect(yield* countOf('catalog_categories')).toBe(1);
    }),
    blockedAtVersion10(),
  );

  itEffect(
    'fails with SqlError and runs no migration when the wipe fails',
    Effect.gen(function* () {
      const db = yield* SqliteClient;
      yield* Effect.promise(() => db.execAsync('DROP TABLE app_state;'));

      const result = yield* Effect.either(resetLocalData);

      expect(Either.isLeft(result) && result.left._tag).toBe('SqlError');
      expect((yield* (yield* SchemaStatus).current).toVersion).toBe(10);
    }),
    blockedAtVersion10(),
  );
});

/**
 * A database at the app's last version holding two routines named alike, whose launch then
 * failed on `UNIQUE_NAMES`, with a `SchemaStatus` that runs the migrations for real.
 */
function blockedAtVersion10() {
  const steps = [...migrations, UNIQUE_NAMES];
  const version = (db: SqliteDatabase) =>
    Effect.promise(() => db.getFirstAsync<{ user_version: number }>('PRAGMA user_version')).pipe(
      Effect.map(row => row?.user_version ?? 0),
    );
  const migrate = (db: SqliteDatabase) =>
    Effect.gen(function* () {
      const fromVersion = yield* version(db);
      const result = yield* Effect.either(runMigrations(db, steps));
      const report: SchemaReport = {
        fromVersion,
        toVersion: yield* version(db),
        migrationError: Either.isLeft(result) ? result.left : null,
      };
      return report;
    });
  const status = Layer.effect(
    SchemaStatus,
    Effect.gen(function* () {
      const db = yield* SqliteClient;
      yield* runMigrations(db, migrations);
      yield* Effect.promise(() =>
        db.execAsync(`
          INSERT INTO routines (id, name, created_at, updated_at) VALUES ('r1', 'Push day', 1, 1);
          INSERT INTO routines (id, name, created_at, updated_at) VALUES ('r2', 'Push day', 2, 2);
          INSERT INTO catalog_categories (id, name) VALUES (10, 'Chest');
        `),
      );
      const last = yield* Ref.make(yield* migrate(db));
      return SchemaStatus.of({
        current: Ref.get(last),
        remigrate: migrate(db).pipe(Effect.tap(report => Ref.set(last, report))),
      });
    }),
  );
  return status.pipe(Layer.provideMerge(makeNodeSqliteLayer()));
}
