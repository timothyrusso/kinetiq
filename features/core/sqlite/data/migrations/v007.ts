import type { Migration } from '@timothyrusso/effect-core';

/**
 * Kinetiq became a lifting-only tracker. Cardio rows are deleted rather than hidden, and
 * the table is rebuilt without the columns only they used: SQLite cannot drop a column
 * that an index or an older build might still name, so a copy into a fresh table is the
 * one form that works on every version the app ships with. `cache_version` goes with them;
 * nothing has read it since the route cache it versioned.
 *
 * The table keeps its name, and so does the `Activity` type: renaming either would touch
 * every query for a word the user never sees.
 *
 * The abandoned cardio recording and the pace-vs-speed preference are removed in the same
 * step, so no row survives that only a deleted feature could read.
 */
export const v007: Migration = {
  version: 7,
  up: async txn => {
    await txn.execAsync(`
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
};
