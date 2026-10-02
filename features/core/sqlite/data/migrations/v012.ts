import type { Migration } from '@timothyrusso/effect-core';

/**
 * The catalog tables of v9, children first, so the drop holds whether or not foreign keys are
 * enforced on the connection.
 */
const V9_CATALOG_TABLES = [
  'catalog_exercise_equipment',
  'catalog_exercise_muscles',
  'catalog_translations',
  'catalog_exercises',
  'catalog_muscles',
  'catalog_equipment',
  'catalog_categories',
  'catalog_meta',
] as const;

/**
 * Schema v12: the catalog on the app's own dataset.
 *
 * Muscles and equipment are junction tables keyed by the dataset's text keys, indexed for the
 * picker's filters; a muscle keeps its position, so "the first primary muscle" is a read. There is
 * no taxonomy table: the labels are the translation catalog's. Instructions are the steps as a
 * JSON list. `lead_count` is how many names in the language share the name's first two words, the
 * search's tiebreak inside a rank. Images are asset paths into the bundle.
 */
const CATALOG_SCHEMA = `
  CREATE TABLE catalog_meta (
    key   TEXT PRIMARY KEY NOT NULL,
    value TEXT NOT NULL
  );

  CREATE TABLE catalog_exercises (
    id            TEXT PRIMARY KEY NOT NULL,
    body_area     TEXT NOT NULL,
    training_type TEXT NOT NULL,
    level         TEXT NOT NULL,
    force         TEXT,
    mechanic      TEXT,
    image_start   TEXT,
    image_end     TEXT,
    thumbnail     TEXT
  );
  CREATE INDEX idx_catalog_exercises_body_area ON catalog_exercises(body_area);

  CREATE TABLE catalog_translations (
    exercise_id  TEXT NOT NULL REFERENCES catalog_exercises(id) ON DELETE CASCADE,
    language     TEXT NOT NULL,
    name         TEXT NOT NULL,
    name_search  TEXT NOT NULL,
    lead_count   INTEGER NOT NULL,
    instructions TEXT NOT NULL,
    PRIMARY KEY (exercise_id, language)
  );
  CREATE INDEX idx_catalog_translations_search ON catalog_translations(language, name_search);

  CREATE TABLE catalog_exercise_muscles (
    exercise_id TEXT NOT NULL REFERENCES catalog_exercises(id) ON DELETE CASCADE,
    muscle      TEXT NOT NULL,
    role        TEXT NOT NULL,
    position    INTEGER NOT NULL,
    PRIMARY KEY (exercise_id, muscle, role)
  );
  CREATE INDEX idx_catalog_exercise_muscles_muscle ON catalog_exercise_muscles(muscle, role);

  CREATE TABLE catalog_exercise_equipment (
    exercise_id TEXT NOT NULL REFERENCES catalog_exercises(id) ON DELETE CASCADE,
    equipment   TEXT NOT NULL,
    PRIMARY KEY (exercise_id, equipment)
  );
  CREATE INDEX idx_catalog_exercise_equipment_equipment ON catalog_exercise_equipment(equipment);
`;

/**
 * The previous catalog goes (#151): its tables are dropped and the new ones created empty, and
 * the launch installs the bundled dataset into them. They hold reference data only, so nothing the
 * user made is lost; the routines and sessions that name an exercise of the previous catalog keep
 * rendering from their stored snapshot. No user table changes.
 */
export const v012: Migration = {
  version: 12,
  up: async txn => {
    for (const table of V9_CATALOG_TABLES) await txn.execAsync(`DROP TABLE ${table};`);
    await txn.execAsync(CATALOG_SCHEMA);
  },
};
