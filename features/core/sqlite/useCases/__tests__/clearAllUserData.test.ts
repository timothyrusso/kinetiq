import { Effect } from 'effect';
import { SqliteClient } from '@/features/core/sqlite';
import { clearAllUserData } from '@/features/core/sqlite/useCases/clearAllUserData';
import { itEffect, makeMigratedSqliteLayer } from '@/features/core/testing';

const countOf = (table: string) =>
  Effect.flatMap(SqliteClient, db =>
    Effect.promise(() => db.getFirstAsync<{ n: number }>(`SELECT COUNT(*) AS n FROM ${table}`)),
  ).pipe(Effect.map(row => row?.n ?? 0));

describe('clearAllUserData', () => {
  itEffect(
    'empties every user table and keeps the exercise catalog',
    Effect.gen(function* () {
      const db = yield* SqliteClient;
      yield* Effect.promise(() =>
        db.execAsync(`
          INSERT INTO routines (id, name, created_at, updated_at) VALUES ('r1', 'Push day', 1, 1);
          INSERT INTO exercises (id, name, captured_at) VALUES ('e1', 'Bench press', 1);
          INSERT INTO routine_items (id, routine_id, exercise_id, position, sets, reps, weight_kg, rest_seconds)
            VALUES ('i1', 'r1', 'e1', 0, 3, '8', 60, 90);
          INSERT INTO activities (id, kind, title, started_at, duration_seconds, calories_kcal, created_at)
            VALUES ('a1', 'lift', 'Push day', 1, 3600, 300, 1);
          INSERT INTO settings (key, value_json, updated_at) VALUES ('settings.units', '"metric"', 1);
          INSERT INTO app_state (key, value_json) VALUES ('session.active', '"s1"');
          INSERT INTO catalog_meta (key, value) VALUES ('version', '1');
          INSERT INTO catalog_categories (id, name) VALUES (10, 'Chest');
        `),
      );

      yield* clearAllUserData;

      for (const table of [
        'routine_items',
        'routines',
        'activities',
        'sessions',
        'records',
        'exercises',
        'settings',
        'app_state',
      ]) {
        expect([table, yield* countOf(table)]).toEqual([table, 0]);
      }
      expect(yield* countOf('catalog_meta')).toBe(1);
      expect(yield* countOf('catalog_categories')).toBe(1);
    }),
    makeMigratedSqliteLayer(),
  );
});
