import { Effect, Layer } from 'effect';
import { BackgroundSync } from '@/features/core/lifecycle';
import { SqliteClient } from '@/features/core/sqlite';
import { itEffect, makeMigratedSqliteLayer } from '@/features/core/testing';
import { eraseAllData } from '@/features/profile/useCases/eraseAllData';

const mirror = { pushes: 0, syncs: 0 };

const testLayer = () =>
  Layer.mergeAll(
    makeMigratedSqliteLayer(),
    Layer.succeed(BackgroundSync, {
      install: Effect.void,
      sync: Effect.sync(() => {
        mirror.syncs += 1;
      }),
      push: Effect.sync(() => {
        mirror.pushes += 1;
      }),
    }),
  );

const exec = (sql: string) => Effect.flatMap(SqliteClient, db => Effect.promise(() => db.execAsync(sql)));
const countOf = (table: string) =>
  Effect.flatMap(SqliteClient, db =>
    Effect.promise(() => db.getFirstAsync<{ n: number }>(`SELECT COUNT(*) AS n FROM ${table}`)),
  ).pipe(Effect.map(row => row?.n ?? 0));

beforeEach(() => {
  mirror.pushes = 0;
  mirror.syncs = 0;
});

describe('eraseAllData', () => {
  itEffect(
    'empties the routines and the history and pushes to the watch once',
    Effect.gen(function* () {
      yield* exec(`
        INSERT INTO routines (id, name, created_at, updated_at) VALUES ('r1', 'Push day', 1, 1);
        INSERT INTO activities (id, kind, title, started_at, duration_seconds, calories_kcal, created_at)
          VALUES ('a1', 'lift', 'Push day', 1, 3600, 300, 1);
      `);

      yield* eraseAllData;

      expect([yield* countOf('routines'), yield* countOf('activities')]).toEqual([0, 0]);
      expect(mirror.pushes).toBe(1);
    }),
    testLayer(),
  );

  itEffect(
    'never drains the watch inbox, so a pending watch workout is not saved back into the erased history',
    Effect.gen(function* () {
      yield* eraseAllData;

      expect(mirror.syncs).toBe(0);
    }),
    testLayer(),
  );

  itEffect(
    'fails with SqlError when the wipe fails, keeping every row and syncing nothing',
    Effect.gen(function* () {
      yield* exec(`
        INSERT INTO routines (id, name, created_at, updated_at) VALUES ('r1', 'Push day', 1, 1);
        DROP TABLE app_state;
      `);

      const result = yield* Effect.either(eraseAllData);

      expect(result._tag === 'Left' && result.left._tag).toBe('SqlError');
      expect(yield* countOf('routines')).toBe(1);
      expect(mirror.pushes).toBe(0);
    }),
    testLayer(),
  );
});
