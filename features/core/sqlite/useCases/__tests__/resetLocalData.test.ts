import { runMigrations } from '@timothyrusso/effect-core';
import { Effect, Either, Layer } from 'effect';
import { makeSchemaStatus, migrations, SchemaStatus, SqliteClient } from '@/features/core/sqlite';
import { resetLocalData } from '@/features/core/sqlite/useCases/resetLocalData';
import { itEffect, makeNodeSqliteLayer } from '@/features/core/testing';

/** A step past the app's last one that cannot pass while two routines share a name. */
const UNIQUE_NAMES = { version: 14, up: 'CREATE UNIQUE INDEX idx_routines_name ON routines (name);' };

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

      expect(report).toEqual({ fromVersion: 13, toVersion: 14, migrationError: null });
      expect(yield* status.current).toEqual(report);
      expect(yield* countOf('routines')).toBe(0);
    }),
    blockedAtVersion13(),
  );

  itEffect(
    'keeps the exercise catalog through the reset',
    Effect.gen(function* () {
      yield* resetLocalData;

      expect(yield* countOf('catalog_exercises')).toBe(1);
    }),
    blockedAtVersion13(),
  );

  itEffect(
    'fails with SqlError and runs no migration when the wipe fails',
    Effect.gen(function* () {
      const db = yield* SqliteClient;
      yield* Effect.promise(() => db.execAsync('DROP TABLE app_state;'));

      const result = yield* Effect.either(resetLocalData);

      expect(Either.isLeft(result) && result.left._tag).toBe('SqlError');
      expect((yield* (yield* SchemaStatus).current).toVersion).toBe(13);
    }),
    blockedAtVersion13(),
  );
});

/**
 * A database at the app's last version holding two routines named alike, whose launch then
 * failed on `UNIQUE_NAMES`, with the app's own `SchemaStatus` over those steps.
 */
function blockedAtVersion13() {
  const status = Layer.effect(
    SchemaStatus,
    Effect.gen(function* () {
      const db = yield* SqliteClient;
      yield* runMigrations(db, migrations);
      yield* Effect.promise(() =>
        db.execAsync(`
          INSERT INTO routines (id, name, created_at, updated_at) VALUES ('r1', 'Push day', 1, 1);
          INSERT INTO routines (id, name, created_at, updated_at) VALUES ('r2', 'Push day', 2, 2);
          INSERT INTO catalog_exercises (id, body_area, training_type, level) VALUES ('ex:dips', 'arms', 'strength', 'beginner');
        `),
      );
      return yield* makeSchemaStatus(db, [...migrations, UNIQUE_NAMES]);
    }),
  );
  return status.pipe(Layer.provideMerge(makeNodeSqliteLayer()));
}
