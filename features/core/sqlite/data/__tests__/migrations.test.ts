import { type Migration, runMigrations, SqlError, SqliteClient, type SqliteDatabase } from '@timothyrusso/effect-core';
import { itEffect, makeNodeSqliteLayer } from '@timothyrusso/effect-core/testing';
import { Effect } from 'effect';
import { SCHEMA_V10 } from '@/features/core/sqlite/data/__tests__/schemaV10';
import { SCHEMA_V11 } from '@/features/core/sqlite/data/__tests__/schemaV11';
import { SCHEMA_V12 } from '@/features/core/sqlite/data/__tests__/schemaV12';
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

const upTo = (version: number) => migrations.filter(migration => migration.version <= version);

const all = <T>(db: SqliteDatabase, sql: string) => Effect.promise(() => db.getAllAsync<T>(sql));

describe('migrations', () => {
  it('declares one step per version, 1 to 12, in order', () => {
    expect(migrations.map(migration => migration.version)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
  });

  itEffect(
    'bring an empty database to the schema main ships at v10',
    Effect.gen(function* () {
      const db = yield* SqliteClient;
      yield* runMigrations(db, upTo(10));
      expect(yield* userVersion(db)).toBe(10);
      expect(yield* schemaOf(db)).toEqual(SCHEMA_V10);
    }),
    makeNodeSqliteLayer(),
  );

  itEffect(
    'bring an empty database to the v11 schema at v11',
    Effect.gen(function* () {
      const db = yield* SqliteClient;
      yield* runMigrations(db, upTo(11));
      expect(yield* userVersion(db)).toBe(11);
      expect(yield* schemaOf(db)).toEqual(SCHEMA_V11);
    }),
    makeNodeSqliteLayer(),
  );

  itEffect(
    'bring an empty database to the last version with the v12 schema, and run again as a no-op',
    Effect.gen(function* () {
      const db = yield* SqliteClient;
      const first = yield* runMigrations(db, migrations);
      expect(first).toEqual({ from: 0, to: lastVersion, applied: migrations.map(migration => migration.version) });
      expect(yield* userVersion(db)).toBe(12);
      expect(yield* schemaOf(db)).toEqual(SCHEMA_V12);
      const second = yield* runMigrations(db, migrations);
      expect(second.applied).toEqual([]);
    }),
    makeNodeSqliteLayer(),
  );

  itEffect(
    'bring a v7 database to the last version, keeping its rows and dropping what v8 to v12 remove',
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

      expect(report).toEqual({ from: 7, to: 12, applied: [8, 9, 10, 11, 12] });
      expect(yield* userVersion(db)).toBe(12);
      expect(yield* schemaOf(db)).toEqual(SCHEMA_V12);
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
        version: 13,
        up: async txn => {
          await txn.execAsync('CREATE TABLE half_done (id TEXT PRIMARY KEY);');
          await txn.execAsync('ALTER TABLE no_such_table ADD COLUMN x TEXT;');
        },
      };

      const failure = yield* Effect.flip(runMigrations(db, [...migrations, broken]));

      expect(failure).toBeInstanceOf(SqlError);
      expect(yield* userVersion(db)).toBe(12);
      const tables = yield* Effect.promise(() =>
        db.getAllAsync<{ name: string }>("SELECT name FROM sqlite_master WHERE name = 'half_done'"),
      );
      expect(tables).toEqual([]);
    }),
    makeNodeSqliteLayer(),
  );
});

/** A v10 database, as `main` leaves it, holding a push day whose items span the stored shapes. */
const V10_ROWS = `
  INSERT INTO routines (id, name, created_at, updated_at, times_completed, last_performed_at)
    VALUES ('r1', 'Push day', 1, 2, 3, 4);
  INSERT INTO exercises (id, name, captured_at) VALUES ('e1', 'Bench press', 1);
  INSERT INTO exercises (id, name, captured_at) VALUES ('e2', 'Dips', 1);
  INSERT INTO routine_items (id, routine_id, exercise_id, position, sets, reps, weight_kg, rest_seconds, notes, exercise_name)
    VALUES ('i_range', 'r1', 'e1', 0, 3, '8-12', 60, 90, 'Tuck the elbows', 'Bench press');
  INSERT INTO routine_items (id, routine_id, exercise_id, position, sets, reps, weight_kg, rest_seconds, notes, exercise_name)
    VALUES ('i_single', 'r1', 'e2', 1, 1, '10', 0, 60, NULL, 'Dips');
  INSERT INTO routine_items (id, routine_id, exercise_id, position, sets, reps, weight_kg, rest_seconds, notes, exercise_name)
    VALUES ('i_twenty', 'r1', 'e1', 2, 20, '5', 142.5, 180, NULL, 'Bench press');
  INSERT INTO routine_items (id, routine_id, exercise_id, position, sets, reps, weight_kg, rest_seconds, notes, exercise_name)
    VALUES ('i_text', 'r1', 'e2', 3, 2, 'AMRAP', 0, 30, NULL, 'Dips');
  INSERT INTO routine_items (id, routine_id, exercise_id, position, sets, reps, weight_kg, rest_seconds, notes, exercise_name)
    VALUES ('i_none', 'r1', 'e2', 4, 0, '6 - 8', 20, 45, NULL, 'Dips');
  INSERT INTO activities (id, kind, title, started_at, duration_seconds, calories_kcal, notes, source_session_id,
                          entries_json, volume_kg, total_sets, created_at)
    VALUES ('a1', 'lift', 'Push day', 1000, 2700.5, 278, 'Felt strong', 'session-1', '[]', 780.5, 12, 1001);
  INSERT INTO activities (id, kind, title, started_at, duration_seconds, calories_kcal, notes, source_session_id,
                          entries_json, volume_kg, total_sets, created_at)
    VALUES ('a2', 'lift', 'Damaged', 2000, 60, 0, NULL, NULL, NULL, NULL, NULL, 2000);
  INSERT INTO sessions (id, routine_id, routine_name, started_at, elapsed_seconds, status, entries_json, active_index,
                        rest_ends_at, rest_duration, notes, updated_at)
    VALUES ('s1', 'r1', 'Push day', 3000, 120, 'active', '[]', 1, 3100, 90, 'Mid-workout', 3050);
  INSERT INTO records (exercise_id, kind, exercise_name, value, achieved_at) VALUES ('e1', 'est1rm', 'Bench press', 116.5, 1000);
  INSERT INTO settings (key, value_json, updated_at) VALUES ('settings.units', '"metric"', 1);
  INSERT INTO app_state (key, value_json) VALUES ('session.active', '"s1"');
  INSERT INTO catalog_meta (key, value) VALUES ('version', '1');
  INSERT INTO catalog_categories (id, name) VALUES (10, 'Chest');
`;

/** Every table a v10 database holds rows in whose rows v11 keeps exactly as they were. */
const UNCHANGED_TABLES = [
  'routines',
  'exercises',
  'sessions',
  'records',
  'settings',
  'app_state',
  'catalog_meta',
  'catalog_categories',
] as const;

const seededV10 = Effect.gen(function* () {
  const db = yield* SqliteClient;
  yield* runMigrations(db, upTo(10));
  yield* Effect.promise(() => db.execAsync(V10_ROWS));
  return db;
});

type SetRow = { item_id: string; position: number; reps: number; weight_kg: number; target_rpe: number | null };

const setsOf = (sets: readonly SetRow[], itemId: string) =>
  sets.filter(set => set.item_id === itemId).map(({ item_id: _item, ...set }) => set);

describe('migration 11: per-set routine targets', () => {
  itEffect(
    'opens a v10 database from main and keeps every row of every table',
    Effect.gen(function* () {
      const db = yield* seededV10;
      const before = [];
      for (const table of UNCHANGED_TABLES) before.push(yield* all(db, `SELECT * FROM ${table} ORDER BY rowid`));
      const counts = (yield* all<{ n: number }>(
        db,
        'SELECT (SELECT COUNT(*) FROM routine_items) + (SELECT COUNT(*) FROM activities) AS n',
      ))[0]?.n;

      const report = yield* runMigrations(db, upTo(11));

      expect(report).toEqual({ from: 10, to: 11, applied: [11] });
      const after = [];
      for (const table of UNCHANGED_TABLES) after.push(yield* all(db, `SELECT * FROM ${table} ORDER BY rowid`));
      expect(after).toEqual(before);
      expect(
        (yield* all<{ n: number }>(
          db,
          'SELECT (SELECT COUNT(*) FROM routine_items) + (SELECT COUNT(*) FROM activities) AS n',
        ))[0]?.n,
      ).toBe(counts);
      expect(yield* schemaOf(db)).toEqual(SCHEMA_V11);
    }),
    makeNodeSqliteLayer(),
  );

  itEffect(
    'turns each item into one set row per set, on the lower bound of a range, a single number as it is, and its weight',
    Effect.gen(function* () {
      const db = yield* seededV10;

      yield* runMigrations(db, upTo(11));

      const sets = yield* all<SetRow>(db, 'SELECT * FROM routine_item_sets ORDER BY item_id, position');
      const planned = (count: number, reps: number, weightKg: number) =>
        Array.from({ length: count }, (_, position) => ({ position, reps, weight_kg: weightKg, target_rpe: null }));
      expect(setsOf(sets, 'i_range')).toEqual(planned(3, 8, 60));
      expect(setsOf(sets, 'i_single')).toEqual(planned(1, 10, 0));
      expect(setsOf(sets, 'i_twenty')).toEqual(planned(20, 5, 142.5));
      expect(setsOf(sets, 'i_text')).toEqual(planned(2, 8, 0));
      expect(setsOf(sets, 'i_none')).toEqual(planned(1, 6, 20));
    }),
    makeNodeSqliteLayer(),
  );

  itEffect(
    'keeps every item with its routine, position, rest, note and name, without the per-item targets',
    Effect.gen(function* () {
      const db = yield* seededV10;

      yield* runMigrations(db, upTo(11));

      expect(yield* columnsOf(db, 'routine_items')).toEqual([
        'id',
        'routine_id',
        'exercise_id',
        'position',
        'rest_seconds',
        'notes',
        'exercise_name',
      ]);
      expect(yield* all(db, 'SELECT * FROM routine_items ORDER BY position')).toEqual([
        {
          id: 'i_range',
          routine_id: 'r1',
          exercise_id: 'e1',
          position: 0,
          rest_seconds: 90,
          notes: 'Tuck the elbows',
          exercise_name: 'Bench press',
        },
        {
          id: 'i_single',
          routine_id: 'r1',
          exercise_id: 'e2',
          position: 1,
          rest_seconds: 60,
          notes: null,
          exercise_name: 'Dips',
        },
        {
          id: 'i_twenty',
          routine_id: 'r1',
          exercise_id: 'e1',
          position: 2,
          rest_seconds: 180,
          notes: null,
          exercise_name: 'Bench press',
        },
        {
          id: 'i_text',
          routine_id: 'r1',
          exercise_id: 'e2',
          position: 3,
          rest_seconds: 30,
          notes: null,
          exercise_name: 'Dips',
        },
        {
          id: 'i_none',
          routine_id: 'r1',
          exercise_id: 'e2',
          position: 4,
          rest_seconds: 45,
          notes: null,
          exercise_name: 'Dips',
        },
      ]);
    }),
    makeNodeSqliteLayer(),
  );

  itEffect(
    'keeps every workout and every column of it except the energy estimate',
    Effect.gen(function* () {
      const db = yield* seededV10;

      yield* runMigrations(db, upTo(11));

      expect(yield* columnsOf(db, 'activities')).toEqual([
        'id',
        'kind',
        'title',
        'started_at',
        'duration_seconds',
        'notes',
        'source_session_id',
        'entries_json',
        'volume_kg',
        'total_sets',
        'created_at',
      ]);
      expect(yield* all(db, 'SELECT * FROM activities ORDER BY started_at')).toEqual([
        {
          id: 'a1',
          kind: 'lift',
          title: 'Push day',
          started_at: 1000,
          duration_seconds: 2700.5,
          notes: 'Felt strong',
          source_session_id: 'session-1',
          entries_json: '[]',
          volume_kg: 780.5,
          total_sets: 12,
          created_at: 1001,
        },
        {
          id: 'a2',
          kind: 'lift',
          title: 'Damaged',
          started_at: 2000,
          duration_seconds: 60,
          notes: null,
          source_session_id: null,
          entries_json: null,
          volume_kg: null,
          total_sets: null,
          created_at: 2000,
        },
      ]);
    }),
    makeNodeSqliteLayer(),
  );

  itEffect(
    'takes an item’s sets with it when the item is deleted',
    Effect.gen(function* () {
      const db = yield* seededV10;
      yield* runMigrations(db, upTo(11));

      yield* Effect.promise(() => db.execAsync("DELETE FROM routines WHERE id = 'r1';"));

      expect(yield* all(db, 'SELECT * FROM routine_item_sets')).toEqual([]);
    }),
    makeNodeSqliteLayer(),
  );
});

/** The catalog tables v12 recreates empty, for the launch to install the bundled dataset into. */
const V12_CATALOG_TABLES = [
  'catalog_meta',
  'catalog_exercises',
  'catalog_translations',
  'catalog_exercise_muscles',
  'catalog_exercise_equipment',
] as const;

/** The user tables a v11 database holds rows in, which v12 keeps exactly as they were. */
const USER_TABLES = [
  'routines',
  'routine_items',
  'routine_item_sets',
  'exercises',
  'activities',
  'sessions',
  'records',
  'settings',
  'app_state',
] as const;

/** A v11 database whose routine names an exercise of the previous catalog, with that catalog installed. */
const seededV11 = Effect.gen(function* () {
  const db = yield* SqliteClient;
  yield* runMigrations(db, upTo(10));
  yield* Effect.promise(() => db.execAsync(V10_ROWS));
  yield* runMigrations(db, upTo(11));
  yield* Effect.promise(() =>
    db.execAsync(`
      INSERT INTO exercises (id, name, external_id, instructions, category, primary_muscles, equipment, image_url, source, captured_at)
        VALUES ('legacy:73', 'Bench Press', 73, 'Lower the bar.', 'Chest', '["Chest"]', '["SZ-Bar"]', 'https://example.com/b.png', 'remote', 5);
      INSERT INTO routine_items (id, routine_id, exercise_id, position, rest_seconds, exercise_name)
        VALUES ('i_legacy', 'r1', 'legacy:73', 5, 90, 'Bench Press');
      INSERT INTO catalog_equipment (id, name) VALUES (1, 'Barbell');
      INSERT INTO catalog_muscles (id, name, name_en, is_front) VALUES (4, 'Pectoralis major', 'Chest', 1);
      INSERT INTO catalog_exercises (id, external_id, category_id) VALUES ('legacy:73', 73, 10);
      INSERT INTO catalog_translations (exercise_id, language, name, name_search) VALUES ('legacy:73', 'en', 'Bench Press', 'bench press');
      INSERT INTO catalog_exercise_muscles (exercise_id, muscle_id, role) VALUES ('legacy:73', 4, 'primary');
      INSERT INTO catalog_exercise_equipment (exercise_id, equipment_id) VALUES ('legacy:73', 1);
    `),
  );
  return db;
});

describe('migration 12: the catalog on the bundled dataset', () => {
  itEffect(
    'keeps every row of every user table, a routine naming an exercise of the previous catalog included',
    Effect.gen(function* () {
      const db = yield* seededV11;
      const before = [];
      for (const table of USER_TABLES) before.push(yield* all(db, `SELECT * FROM ${table} ORDER BY rowid`));

      const report = yield* runMigrations(db, migrations);

      expect(report).toEqual({ from: 11, to: 12, applied: [12] });
      const after = [];
      for (const table of USER_TABLES) after.push(yield* all(db, `SELECT * FROM ${table} ORDER BY rowid`));
      expect(after).toEqual(before);
      expect(yield* schemaOf(db)).toEqual(SCHEMA_V12);
    }),
    makeNodeSqliteLayer(),
  );

  itEffect(
    'drops the previous catalog and leaves the new tables empty for the launch to install',
    Effect.gen(function* () {
      const db = yield* seededV11;

      yield* runMigrations(db, migrations);

      const tables = (yield* all<{ name: string }>(db, "SELECT name FROM sqlite_master WHERE type = 'table'")).map(
        row => row.name,
      );
      expect(tables).not.toEqual(expect.arrayContaining(['catalog_categories']));
      expect(tables).not.toEqual(expect.arrayContaining(['catalog_equipment']));
      expect(tables).not.toEqual(expect.arrayContaining(['catalog_muscles']));
      for (const table of V12_CATALOG_TABLES) {
        const rows = yield* all<{ n: number }>(db, `SELECT COUNT(*) AS n FROM ${table}`);
        expect([table, rows[0]?.n]).toEqual([table, 0]);
      }
    }),
    makeNodeSqliteLayer(),
  );
});
