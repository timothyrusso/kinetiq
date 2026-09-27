import type { Migration } from '@timothyrusso/effect-core';

/**
 * Schema v9: the exercise catalog.
 *
 * Exported so the legacy catalog repository tests can build the same tables in an in-memory
 * database without running every migration.
 *
 * Junction tables rather than JSON arrays, so the muscle and equipment filters are indexed joins.
 * The `exercises` snapshot table and `routine_items.exercise_id` are untouched: the catalog is
 * reference data, and a routine keeps the snapshot it was written with.
 */
export const CATALOG_SCHEMA = `
  CREATE TABLE catalog_meta (
    key   TEXT PRIMARY KEY NOT NULL,
    value TEXT NOT NULL
  );

  CREATE TABLE catalog_categories (id INTEGER PRIMARY KEY, name TEXT NOT NULL);
  CREATE TABLE catalog_equipment  (id INTEGER PRIMARY KEY, name TEXT NOT NULL);
  CREATE TABLE catalog_muscles (
    id       INTEGER PRIMARY KEY,
    name     TEXT NOT NULL,
    name_en  TEXT,
    is_front INTEGER NOT NULL DEFAULT 1
  );

  CREATE TABLE catalog_exercises (
    id              TEXT PRIMARY KEY NOT NULL,
    external_id     INTEGER NOT NULL UNIQUE,
    uuid            TEXT,
    variation_group TEXT,
    category_id     INTEGER NOT NULL REFERENCES catalog_categories(id),
    image_url       TEXT,
    thumbnail_url   TEXT,
    video_url       TEXT
  );
  CREATE INDEX idx_catalog_exercises_category ON catalog_exercises(category_id);
  CREATE INDEX idx_catalog_exercises_variation ON catalog_exercises(variation_group);

  CREATE TABLE catalog_translations (
    exercise_id  TEXT NOT NULL REFERENCES catalog_exercises(id) ON DELETE CASCADE,
    language     TEXT NOT NULL,
    name         TEXT NOT NULL,
    name_search  TEXT NOT NULL,
    instructions TEXT,
    PRIMARY KEY (exercise_id, language)
  );
  CREATE INDEX idx_catalog_translations_search ON catalog_translations(language, name_search);

  CREATE TABLE catalog_exercise_muscles (
    exercise_id TEXT NOT NULL REFERENCES catalog_exercises(id) ON DELETE CASCADE,
    muscle_id   INTEGER NOT NULL REFERENCES catalog_muscles(id),
    role        TEXT NOT NULL,
    PRIMARY KEY (exercise_id, muscle_id, role)
  );
  CREATE INDEX idx_catalog_exercise_muscles_muscle ON catalog_exercise_muscles(muscle_id);

  CREATE TABLE catalog_exercise_equipment (
    exercise_id  TEXT NOT NULL REFERENCES catalog_exercises(id) ON DELETE CASCADE,
    equipment_id INTEGER NOT NULL REFERENCES catalog_equipment(id),
    PRIMARY KEY (exercise_id, equipment_id)
  );
  CREATE INDEX idx_catalog_exercise_equipment_equipment ON catalog_exercise_equipment(equipment_id);
`;

/**
 * The exercise catalog moves into SQLite so search, filters and detail work with no
 * network (issue #39). New tables only: the tables are filled by `replaceCatalog`, and
 * `clearAllUserData` below leaves them alone because the catalog is not user data.
 */
export const v009: Migration = {
  version: 9,
  up: async txn => {
    await txn.execAsync(CATALOG_SCHEMA);
  },
};
