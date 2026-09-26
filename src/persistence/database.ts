/**
 * Database bootstrap and migrations.
 *
 * The schema is versioned in `PRAGMA user_version` and every step is a
 * transaction, so a crash mid-migration leaves the previous version intact
 * rather than a half-applied schema. Adding a column later means appending one
 * entry to MIGRATIONS: never editing an existing step.
 */
import * as SQLite from 'expo-sqlite';
import { notifyRoutinesChanged } from './routineEvents';

const DATABASE_NAME = 'kinetiq.db';

type Migration = {
  version: number;
  up: (db: SQLite.SQLiteDatabase) => Promise<void>;
};

const SCHEMA_V1 = `
  CREATE TABLE IF NOT EXISTS activities (
    id                 TEXT PRIMARY KEY NOT NULL,
    kind               TEXT NOT NULL,
    title              TEXT NOT NULL,
    started_at         INTEGER NOT NULL,
    duration_seconds   REAL NOT NULL,
    calories_kcal      REAL NOT NULL,
    notes              TEXT,
    seeded             INTEGER NOT NULL DEFAULT 0,
    source_session_id  TEXT,
    distance_meters    REAL,
    avg_pace           REAL,
    avg_hr             REAL,
    max_hr             REAL,
    elevation_meters   REAL,
    avg_speed_mps      REAL,
    cadence            REAL,
    splits_json        TEXT,
    route_json         TEXT,
    entries_json       TEXT,
    volume_kg          REAL,
    total_sets         INTEGER,
    created_at         INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_activities_started ON activities (started_at DESC);
  CREATE INDEX IF NOT EXISTS idx_activities_kind ON activities (kind);

  CREATE TABLE IF NOT EXISTS routines (
    id               TEXT PRIMARY KEY NOT NULL,
    name             TEXT NOT NULL,
    description      TEXT,
    created_at       INTEGER NOT NULL,
    updated_at       INTEGER NOT NULL,
    times_completed  INTEGER NOT NULL DEFAULT 0,
    last_performed_at INTEGER,
    seeded           INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS routine_items (
    id            TEXT PRIMARY KEY NOT NULL,
    routine_id    TEXT NOT NULL REFERENCES routines (id) ON DELETE CASCADE,
    exercise_id   TEXT NOT NULL REFERENCES exercises (id) ON DELETE RESTRICT,
    position      INTEGER NOT NULL,
    sets          INTEGER NOT NULL,
    reps          TEXT NOT NULL,
    weight_kg     REAL NOT NULL,
    rest_seconds  INTEGER NOT NULL,
    notes         TEXT
  );
  CREATE INDEX IF NOT EXISTS idx_routine_items_routine ON routine_items (routine_id, position);

  CREATE TABLE IF NOT EXISTS exercises (
    id                TEXT PRIMARY KEY NOT NULL,
    external_id       INTEGER,
    name              TEXT NOT NULL,
    instructions      TEXT,
    category          TEXT,
    primary_muscles   TEXT NOT NULL DEFAULT '[]',
    secondary_muscles TEXT NOT NULL DEFAULT '[]',
    equipment         TEXT NOT NULL DEFAULT '[]',
    image_url         TEXT,
    source            TEXT NOT NULL DEFAULT 'remote',
    captured_at       INTEGER NOT NULL
  );
  CREATE UNIQUE INDEX IF NOT EXISTS idx_exercises_external ON exercises (external_id)
    WHERE external_id IS NOT NULL;

  CREATE TABLE IF NOT EXISTS sessions (
    id                   TEXT PRIMARY KEY NOT NULL,
    routine_id           TEXT,
    routine_name         TEXT NOT NULL,
    started_at           INTEGER NOT NULL,
    elapsed_seconds      REAL NOT NULL DEFAULT 0,
    status               TEXT NOT NULL,
    entries_json         TEXT NOT NULL DEFAULT '[]',
    active_index         INTEGER NOT NULL DEFAULT 0,
    rest_ends_at         INTEGER,
    rest_duration        INTEGER,
    notes                TEXT,
    updated_at           INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_sessions_status ON sessions (status);

  CREATE TABLE IF NOT EXISTS records (
    exercise_id    TEXT NOT NULL,
    kind           TEXT NOT NULL,
    exercise_name  TEXT NOT NULL,
    value          REAL NOT NULL,
    achieved_at    INTEGER NOT NULL,
    PRIMARY KEY (exercise_id, kind)
  );

  CREATE TABLE IF NOT EXISTS settings (
    key        TEXT PRIMARY KEY NOT NULL,
    value_json TEXT NOT NULL,
    updated_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS app_state (
    key        TEXT PRIMARY KEY NOT NULL,
    value_json TEXT NOT NULL
  );
`;

const MIGRATIONS: readonly Migration[] = [
  {
    version: 1,
    up: async (db) => {
      await db.execAsync(SCHEMA_V1);
    },
  },
  {
    // Route polylines were stored as raw GPS samples. Storing a decimated copy
    // keeps map rendering and JSON parsing cheap on long recordings.
    version: 2,
    up: async (db) => {
      await db.execAsync(
        `ALTER TABLE activities ADD COLUMN route_simplified_json TEXT;`,
      );
      await db.execAsync(`ALTER TABLE activities ADD COLUMN cache_version INTEGER NOT NULL DEFAULT 1;`);
    },
  },
  {
    // Routine items need to survive the source exercise being re-fetched or
    // deleted remotely: denormalise the name onto the item at write time.
    version: 3,
    up: async (db) => {
      await db.execAsync(`ALTER TABLE routine_items ADD COLUMN exercise_name TEXT NOT NULL DEFAULT '';`);
      await db.execAsync(`
        UPDATE routine_items
           SET exercise_name = COALESCE((
                 SELECT e.name FROM exercises e WHERE e.id = routine_items.exercise_id
               ), '');
      `);
      await db.execAsync(`ALTER TABLE exercises ADD COLUMN thumbnail_url TEXT;`);
    },
  },
  {
    // `settings.showKmSplits` was the key name left behind by a cut feature and had
    // been storing the pace-vs-speed choice all along. Renaming a settings row is
    // a data move, not a schema change: `INSERT … ON CONFLICT` would happily
    // create the new row and leave the old one stranded, so the user's preference
    // would silently reset to pace on next launch. Move it first, keep the
    // timestamp, and drop the old row only once the value has landed. `OR IGNORE`
    // means an install that already wrote under the new key keeps what it wrote, // which can happen if a build from this branch ran before the migration did.
    version: 4,
    up: async (db) => {
      await db.execAsync(`
        INSERT OR IGNORE INTO settings (key, value_json, updated_at)
             SELECT 'settings.showSpeedInsteadOfPace', value_json, updated_at
               FROM settings
              WHERE key = 'settings.showKmSplits';
      `);
      await db.execAsync(`
        DELETE FROM settings WHERE key = 'settings.showKmSplits';
      `);
    },
  },
  {
    // The em dash is banned in this codebase (see CLAUDE.md), and it had been sitting inside
    // DATA rather than only in source: three seeded routine names carried it, so it rendered
    // on the Workout tab, in the workout pill, and in every history row derived from them.
    // Changing the seed file only fixes a fresh install; anyone who already has these rows
    // keeps them, so the character has to be migrated out of the stored values too.
    //
    // Scoped to the separator form (space, dash, space) rather than every occurrence, and only
    // in rows the seed created. A user who typed an em dash into their own routine name is
    // entitled to keep it; this is undoing something the app shipped, not policing input.
    version: 5,
    up: async (db) => {
      await db.execAsync(`
        UPDATE routines
           SET name = REPLACE(name, ' \u2014 ', ' \u00b7 '),
               description = REPLACE(COALESCE(description, ''), ' \u2014 ', ' \u00b7 ')
         WHERE seeded = 1
           AND (name LIKE '% \u2014 %' OR COALESCE(description, '') LIKE '% \u2014 %');
      `);
      await db.execAsync(`
        UPDATE activities
           SET title = REPLACE(title, ' \u2014 ', ' \u00b7 ')
         WHERE title LIKE '% \u2014 %';
      `);
    },
  },
  {
    // Migration 5 cleaned `routines` and `activities` and missed `sessions.routine_name`,
    // which is where a workout in progress keeps the label it will write into history. So a
    // session that had been paused since before the rename finished afterwards and put the old
    // name straight back into a brand new activity row, one migration too late to be caught.
    //
    // The lesson is worth the comment: a denormalised copy has to be found everywhere it was
    // copied TO, not only where it was copied from. `routine_items.exercise_name` is the same
    // pattern and is covered by the seed rename, since those names never carried the character.
    //
    // `activities` is swept again rather than trusting 5 to have finished the job, because rows
    // created between the two migrations carry the old value by construction.
    version: 6,
    up: async (db) => {
      await db.execAsync(`
        UPDATE sessions
           SET routine_name = REPLACE(routine_name, ' \u2014 ', ' \u00b7 ')
         WHERE routine_name LIKE '% \u2014 %';
      `);
      await db.execAsync(`
        UPDATE activities
           SET title = REPLACE(title, ' \u2014 ', ' \u00b7 ')
         WHERE title LIKE '% \u2014 %';
      `);
    },
  },
  {
    // Kinetiq became a lifting-only tracker. Cardio rows are deleted rather than hidden, and
    // the table is rebuilt without the columns only they used: SQLite cannot drop a column
    // that an index or an older build might still name, so a copy into a fresh table is the
    // one form that works on every version the app ships with. `cache_version` goes with them;
    // nothing has read it since the route cache it versioned.
    //
    // The table keeps its name, and so does the `Activity` type: renaming either would touch
    // every query for a word the user never sees.
    //
    // The abandoned cardio recording and the pace-vs-speed preference are removed in the same
    // step, so no row survives that only a deleted feature could read.
    version: 7,
    up: async (db) => {
      await db.execAsync(`
        DELETE FROM activities WHERE kind <> 'lift';

        CREATE TABLE activities_v7 (
          id                 TEXT PRIMARY KEY NOT NULL,
          kind               TEXT NOT NULL,
          title              TEXT NOT NULL,
          started_at         INTEGER NOT NULL,
          duration_seconds   REAL NOT NULL,
          calories_kcal      REAL NOT NULL,
          notes              TEXT,
          seeded             INTEGER NOT NULL DEFAULT 0,
          source_session_id  TEXT,
          entries_json       TEXT,
          volume_kg          REAL,
          total_sets         INTEGER,
          created_at         INTEGER NOT NULL
        );
        INSERT INTO activities_v7 (
          id, kind, title, started_at, duration_seconds, calories_kcal, notes, seeded,
          source_session_id, entries_json, volume_kg, total_sets, created_at
        )
        SELECT id, kind, title, started_at, duration_seconds, calories_kcal, notes, seeded,
               source_session_id, entries_json, volume_kg, total_sets, created_at
          FROM activities;
        DROP TABLE activities;
        ALTER TABLE activities_v7 RENAME TO activities;
        CREATE INDEX IF NOT EXISTS idx_activities_started ON activities (started_at DESC);

        DELETE FROM app_state WHERE key = 'cardio.draft';
        DELETE FROM settings WHERE key = 'settings.showSpeedInsteadOfPace';
      `);
    },
  },
  {
    // Routines lost their description: the note moved onto each exercise, where it is read
    // mid-set. A column drop, not the table copy migration 7 used, because `routine_items`
    // references `routines ON DELETE CASCADE` and dropping the old table would take every
    // routine's exercises with it. Nothing indexes or triggers on `description`, which is the
    // condition `DROP COLUMN` needs.
    version: 8,
    up: async (db) => {
      await db.execAsync('ALTER TABLE routines DROP COLUMN description;');
    },
  },
];

let database: SQLite.SQLiteDatabase | null = null;
let openPromise: Promise<SQLite.SQLiteDatabase> | null = null;

export type DatabaseOpenResult = {
  db: SQLite.SQLiteDatabase;
  fromVersion: number;
  toVersion: number;
  /** Set when migrations failed; the caller decides how to degrade. */
  migrationError?: unknown;
};

async function readVersion(db: SQLite.SQLiteDatabase): Promise<number> {
  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  return row?.user_version ?? 0;
}

async function applyMigrations(
  db: SQLite.SQLiteDatabase,
  fromVersion: number,
): Promise<number> {
  let version = fromVersion;
  for (const migration of MIGRATIONS) {
    if (migration.version <= version) continue;
    if (migration.version !== version + 1) {
      throw new Error(
        `Missing migration ${version + 1}: cannot jump from schema v${version} to v${migration.version}`,
      );
    }
    await db.withTransactionAsync(async () => {
      await migration.up(db);
      // PRAGMA cannot be parameterised; version is a validated integer literal.
      await db.execAsync(`PRAGMA user_version = ${migration.version}`);
    });
    version = migration.version;
  }
  return version;
}

/**
 * Opens the database exactly once and runs pending migrations. Concurrent
 * callers share the same promise, so a cold launch that mounts several screens
 * cannot race two migration passes.
 */
export function openDatabase(): Promise<DatabaseOpenResult> {
  if (openPromise) {
    return openPromise.then(async (db) => ({
      db,
      fromVersion: await readVersion(db),
      toVersion: await readVersion(db),
    }));
  }

  openPromise = (async () => {
    const db = await SQLite.openDatabaseAsync(DATABASE_NAME);
    await db.execAsync('PRAGMA journal_mode = WAL;');
    await db.execAsync('PRAGMA foreign_keys = ON;');
    return db;
  })();

  return openPromise.then(async (db) => {
    const from = await readVersion(db);
    try {
      const to = await applyMigrations(db, from);
      database = db;
      return { db, fromVersion: from, toVersion: to };
    } catch (error) {
      // Schema is unusable. Keep the handle so reads can fail soft rather than
      // crashing; the bootstrap surfaces the failure to the user.
      database = db;
      return { db, fromVersion: from, toVersion: from, migrationError: error };
    }
  });
}

export function getDatabase(): SQLite.SQLiteDatabase {
  if (!database) throw new Error('Database accessed before openDatabase() resolved');
  return database;
}

/** Test/maintenance hook: wipes user data while keeping the schema. */
export async function clearAllUserData(db?: SQLite.SQLiteDatabase): Promise<void> {
  const handle = db ?? getDatabase();
  await handle.withTransactionAsync(async () => {
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
      await handle.execAsync(`DELETE FROM ${table};`);
    }
  });
  notifyRoutinesChanged();
}
