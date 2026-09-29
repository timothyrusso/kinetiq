import type { Migration } from '@timothyrusso/effect-core';

/**
 * The most sets one item is expanded into. The editor and the import both stop at 20; the cap only
 * keeps a corrupt count from turning the migration into an unbounded loop.
 */
const MAX_SETS = 100;

/**
 * The rep target a stored `reps` text becomes: the number a range starts with (`8-12` is 8), a
 * single number as it is, and 8 for text with no usable number, which is what a workout started
 * from the routine opened with. A frozen copy of the rule the app read reps with before this
 * step, so a later change to that rule cannot change what this step does.
 */
function lowerBound(reps: string): number {
  const first = /(\d+)/.exec(reps)?.[1];
  const parsed = first === undefined ? Number.NaN : Number.parseInt(first, 10);
  return Number.isFinite(parsed) && parsed > 0 && parsed <= 100 ? parsed : 8;
}

/**
 * Per-set routine targets (#106). Each routine item's `sets`, `reps` and `weight_kg` become one
 * `routine_item_sets` row per set, each with the item's weight, the lower bound of its reps and
 * no target RPE; an item stored with no sets gets one, as a workout started from it did. The
 * three columns are then dropped from `routine_items` (no index or trigger names them). Rest and
 * notes stay on the item.
 *
 * The same step drops the estimated energy figure left from the cardio era (#57): `activities` is
 * rebuilt without its column, as migration 7 rebuilt it, keeping every row and every other column.
 */
export const v011: Migration = {
  version: 11,
  up: async txn => {
    await txn.execAsync(`
        CREATE TABLE routine_item_sets (
          item_id     TEXT NOT NULL REFERENCES routine_items (id) ON DELETE CASCADE,
          position    INTEGER NOT NULL,
          reps        INTEGER NOT NULL,
          weight_kg   REAL NOT NULL,
          target_rpe  REAL,
          PRIMARY KEY (item_id, position)
        );
      `);
    const items = await txn.getAllAsync<{ id: string; sets: number; reps: string; weight_kg: number }>(
      'SELECT id, sets, reps, weight_kg FROM routine_items',
    );
    for (const item of items) {
      const count = Math.min(MAX_SETS, Math.max(1, Math.round(item.sets)));
      const reps = lowerBound(item.reps);
      for (let position = 0; position < count; position += 1) {
        await txn.runAsync(
          'INSERT INTO routine_item_sets (item_id, position, reps, weight_kg, target_rpe) VALUES (?, ?, ?, ?, NULL)',
          [item.id, position, reps, item.weight_kg],
        );
      }
    }
    await txn.execAsync(`
        ALTER TABLE routine_items DROP COLUMN sets;
        ALTER TABLE routine_items DROP COLUMN reps;
        ALTER TABLE routine_items DROP COLUMN weight_kg;

        CREATE TABLE activities_v11 (
          id                 TEXT PRIMARY KEY NOT NULL,
          kind               TEXT NOT NULL,
          title              TEXT NOT NULL,
          started_at         INTEGER NOT NULL,
          duration_seconds   REAL NOT NULL,
          notes              TEXT,
          source_session_id  TEXT,
          entries_json       TEXT,
          volume_kg          REAL,
          total_sets         INTEGER,
          created_at         INTEGER NOT NULL
        );
        INSERT INTO activities_v11 (
          id, kind, title, started_at, duration_seconds, notes, source_session_id, entries_json,
          volume_kg, total_sets, created_at
        )
        SELECT id, kind, title, started_at, duration_seconds, notes, source_session_id, entries_json,
               volume_kg, total_sets, created_at
          FROM activities;
        DROP TABLE activities;
        ALTER TABLE activities_v11 RENAME TO activities;
        CREATE INDEX IF NOT EXISTS idx_activities_started ON activities (started_at DESC);
      `);
  },
};
