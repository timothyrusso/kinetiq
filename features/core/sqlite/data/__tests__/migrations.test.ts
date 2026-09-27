import { type Migration, runMigrations, SqlError, SqliteClient, type SqliteDatabase } from '@timothyrusso/effect-core';
import { itEffect, makeNodeSqliteLayer } from '@timothyrusso/effect-core/testing';
import { Effect } from 'effect';
import { SCHEMA_V10 } from '@/features/core/sqlite/data/__tests__/schemaV10';
import { migrations } from '@/features/core/sqlite/data/migrations';

const lastVersion = Math.max(...migrations.map(migration => migration.version));

const userVersion = (db: SqliteDatabase) =>
  Effect.promise(() => db.getFirstAsync<{ user_version: number }>('PRAGMA user_version')).pipe(
    Effect.map(row => row?.user_version ?? 0),
  );

const schemaOf = (db: SqliteDatabase) =>
  Effect.promise(() =>
    db.getAllAsync<{ type: string; name: string; tbl_name: string; sql: string | null }>(
      "SELECT type, name, tbl_name, sql FROM sqlite_master WHERE name NOT LIKE 'sqlite_%' ORDER BY type, name",
    ),
  );

const columnsOf = (db: SqliteDatabase, table: string) =>
  Effect.promise(() => db.getAllAsync<{ name: string }>(`PRAGMA table_info(${table})`)).pipe(
    Effect.map(rows => rows.map(row => row.name)),
  );

describe('migrations', () => {
  it('declares one step per version, 1 to 10, in order', () => {
    expect(migrations.map(migration => migration.version)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  });

  itEffect(
    'bring an empty database to the last version with the schema main ships, and run again as a no-op',
    Effect.gen(function* () {
      const db = yield* SqliteClient;
      const first = yield* runMigrations(db, migrations);
      expect(first).toEqual({ from: 0, to: lastVersion, applied: migrations.map(migration => migration.version) });
      expect(yield* userVersion(db)).toBe(10);
      expect(yield* schemaOf(db)).toEqual(SCHEMA_V10);
      const second = yield* runMigrations(db, migrations);
      expect(second.applied).toEqual([]);
    }),
    makeNodeSqliteLayer(),
  );

  itEffect(
    'bring a v7 database to the last version, keeping its rows and dropping what v8 to v10 remove',
    Effect.gen(function* () {
      const db = yield* SqliteClient;
      yield* runMigrations(
        db,
        migrations.filter(migration => migration.version <= 7),
      );
      expect(yield* userVersion(db)).toBe(7);
      yield* Effect.promise(() =>
        db.execAsync(`
          INSERT INTO routines (id, name, description, created_at, updated_at, seeded)
            VALUES ('r1', 'Push day', 'Chest and triceps', 1, 1, 1);
          INSERT INTO exercises (id, name, captured_at) VALUES ('e1', 'Bench press', 1);
          INSERT INTO routine_items (id, routine_id, exercise_id, position, sets, reps, weight_kg, rest_seconds, exercise_name)
            VALUES ('i1', 'r1', 'e1', 0, 3, '8-12', 60, 90, 'Bench press');
          INSERT INTO activities (id, kind, title, started_at, duration_seconds, calories_kcal, seeded, created_at)
            VALUES ('a1', 'lift', 'Push day', 1, 3600, 300, 1, 1);
          INSERT INTO app_state (key, value_json) VALUES ('seed.done', 'true');
          INSERT INTO app_state (key, value_json) VALUES ('session.active', '"s1"');
        `),
      );

      const report = yield* runMigrations(db, migrations);

      expect(report).toEqual({ from: 7, to: 10, applied: [8, 9, 10] });
      expect(yield* userVersion(db)).toBe(10);
      expect(yield* schemaOf(db)).toEqual(SCHEMA_V10);
      expect(yield* columnsOf(db, 'routines')).not.toEqual(expect.arrayContaining(['description']));
      expect(yield* columnsOf(db, 'routines')).not.toEqual(expect.arrayContaining(['seeded']));
      expect(yield* columnsOf(db, 'activities')).not.toEqual(expect.arrayContaining(['seeded']));
      const rows = yield* Effect.promise(() =>
        Promise.all([
          db.getAllAsync('SELECT id, name FROM routines'),
          db.getAllAsync('SELECT id, routine_id, exercise_name FROM routine_items'),
          db.getAllAsync('SELECT id, title FROM activities'),
          db.getAllAsync('SELECT key FROM app_state ORDER BY key'),
        ]),
      );
      expect(rows).toEqual([
        [{ id: 'r1', name: 'Push day' }],
        [{ id: 'i1', routine_id: 'r1', exercise_name: 'Bench press' }],
        [{ id: 'a1', title: 'Push day' }],
        [{ key: 'session.active' }],
      ]);
    }),
    makeNodeSqliteLayer(),
  );

  itEffect(
    'run each step in its own transaction: a failing step rolls back and keeps the last good version',
    Effect.gen(function* () {
      const db = yield* SqliteClient;
      yield* runMigrations(db, migrations);
      const broken: Migration = {
        version: 11,
        up: async txn => {
          await txn.execAsync('CREATE TABLE half_done (id TEXT PRIMARY KEY);');
          await txn.execAsync('ALTER TABLE no_such_table ADD COLUMN x TEXT;');
        },
      };

      const failure = yield* Effect.flip(runMigrations(db, [...migrations, broken]));

      expect(failure).toBeInstanceOf(SqlError);
      expect(yield* userVersion(db)).toBe(10);
      const tables = yield* Effect.promise(() =>
        db.getAllAsync<{ name: string }>("SELECT name FROM sqlite_master WHERE name = 'half_done'"),
      );
      expect(tables).toEqual([]);
    }),
    makeNodeSqliteLayer(),
  );
});
