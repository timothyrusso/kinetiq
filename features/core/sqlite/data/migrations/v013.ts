import type { Migration } from '@timothyrusso/effect-core';

/**
 * Tracking types (#169): an exercise records weight and reps, reps alone, or time.
 *
 * Every workout, open session, personal record and routine is deleted, by the owner's decision:
 * nothing is converted, so no row written before tracking types is ever read again. The exercise
 * snapshots, the settings, the app state and the catalog stay. `routine_items` and
 * `routine_item_sets` are then created again, empty: an item names its `tracking_type`, and a set
 * row holds the values its item's type records (reps and a weight, reps, or `duration_seconds`),
 * the others null; a row with neither reps nor a duration records nothing and is refused. Foreign
 * keys are off on a migration's connection; children go first all the same, so the step holds
 * either way.
 */
export const v013: Migration = {
  version: 13,
  up: async txn => {
    await txn.execAsync(`
        DELETE FROM activities;
        DELETE FROM sessions;
        DELETE FROM records;
        DROP TABLE routine_item_sets;
        DROP TABLE routine_items;
        DELETE FROM routines;

        CREATE TABLE routine_items (
          id             TEXT PRIMARY KEY NOT NULL,
          routine_id     TEXT NOT NULL REFERENCES routines (id) ON DELETE CASCADE,
          exercise_id    TEXT NOT NULL REFERENCES exercises (id) ON DELETE RESTRICT,
          exercise_name  TEXT NOT NULL,
          tracking_type  TEXT NOT NULL,
          position       INTEGER NOT NULL,
          rest_seconds   INTEGER NOT NULL,
          notes          TEXT
        );
        CREATE INDEX idx_routine_items_routine ON routine_items (routine_id, position);

        CREATE TABLE routine_item_sets (
          item_id           TEXT NOT NULL REFERENCES routine_items (id) ON DELETE CASCADE,
          position          INTEGER NOT NULL,
          reps              INTEGER,
          weight_kg         REAL,
          duration_seconds  INTEGER,
          target_rpe        REAL,
          PRIMARY KEY (item_id, position),
          CHECK (reps IS NOT NULL OR duration_seconds IS NOT NULL)
        );
      `);
  },
};
