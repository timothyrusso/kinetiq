/**
 * `sqlite_master` after every migration ran on an empty database: the schema a v12 install has
 * on disk (#151). The per-file migrations must produce exactly this.
 */
export const SCHEMA_V12 = [
  {
    type: 'index',
    name: 'idx_activities_started',
    tbl_name: 'activities',
    sql: 'CREATE INDEX idx_activities_started ON activities (started_at DESC)',
  },
  {
    type: 'index',
    name: 'idx_catalog_exercise_equipment_equipment',
    tbl_name: 'catalog_exercise_equipment',
    sql: 'CREATE INDEX idx_catalog_exercise_equipment_equipment ON catalog_exercise_equipment(equipment)',
  },
  {
    type: 'index',
    name: 'idx_catalog_exercise_muscles_muscle',
    tbl_name: 'catalog_exercise_muscles',
    sql: 'CREATE INDEX idx_catalog_exercise_muscles_muscle ON catalog_exercise_muscles(muscle, role)',
  },
  {
    type: 'index',
    name: 'idx_catalog_exercises_body_area',
    tbl_name: 'catalog_exercises',
    sql: 'CREATE INDEX idx_catalog_exercises_body_area ON catalog_exercises(body_area)',
  },
  {
    type: 'index',
    name: 'idx_catalog_translations_search',
    tbl_name: 'catalog_translations',
    sql: 'CREATE INDEX idx_catalog_translations_search ON catalog_translations(language, name_search)',
  },
  {
    type: 'index',
    name: 'idx_exercises_external',
    tbl_name: 'exercises',
    sql: 'CREATE UNIQUE INDEX idx_exercises_external ON exercises (external_id)\n    WHERE external_id IS NOT NULL',
  },
  {
    type: 'index',
    name: 'idx_routine_items_routine',
    tbl_name: 'routine_items',
    sql: 'CREATE INDEX idx_routine_items_routine ON routine_items (routine_id, position)',
  },
  {
    type: 'index',
    name: 'idx_sessions_status',
    tbl_name: 'sessions',
    sql: 'CREATE INDEX idx_sessions_status ON sessions (status)',
  },
  {
    type: 'table',
    name: 'activities',
    tbl_name: 'activities',
    sql: 'CREATE TABLE "activities" (\n          id                 TEXT PRIMARY KEY NOT NULL,\n          kind               TEXT NOT NULL,\n          title              TEXT NOT NULL,\n          started_at         INTEGER NOT NULL,\n          duration_seconds   REAL NOT NULL,\n          notes              TEXT,\n          source_session_id  TEXT,\n          entries_json       TEXT,\n          volume_kg          REAL,\n          total_sets         INTEGER,\n          created_at         INTEGER NOT NULL\n        )',
  },
  {
    type: 'table',
    name: 'app_state',
    tbl_name: 'app_state',
    sql: 'CREATE TABLE app_state (\n    key        TEXT PRIMARY KEY NOT NULL,\n    value_json TEXT NOT NULL\n  )',
  },
  {
    type: 'table',
    name: 'catalog_exercise_equipment',
    tbl_name: 'catalog_exercise_equipment',
    sql: 'CREATE TABLE catalog_exercise_equipment (\n    exercise_id TEXT NOT NULL REFERENCES catalog_exercises(id) ON DELETE CASCADE,\n    equipment   TEXT NOT NULL,\n    PRIMARY KEY (exercise_id, equipment)\n  )',
  },
  {
    type: 'table',
    name: 'catalog_exercise_muscles',
    tbl_name: 'catalog_exercise_muscles',
    sql: 'CREATE TABLE catalog_exercise_muscles (\n    exercise_id TEXT NOT NULL REFERENCES catalog_exercises(id) ON DELETE CASCADE,\n    muscle      TEXT NOT NULL,\n    role        TEXT NOT NULL,\n    position    INTEGER NOT NULL,\n    PRIMARY KEY (exercise_id, muscle, role)\n  )',
  },
  {
    type: 'table',
    name: 'catalog_exercises',
    tbl_name: 'catalog_exercises',
    sql: 'CREATE TABLE catalog_exercises (\n    id            TEXT PRIMARY KEY NOT NULL,\n    body_area     TEXT NOT NULL,\n    training_type TEXT NOT NULL,\n    level         TEXT NOT NULL,\n    force         TEXT,\n    mechanic      TEXT,\n    image_start   TEXT,\n    image_end     TEXT,\n    thumbnail     TEXT\n  )',
  },
  {
    type: 'table',
    name: 'catalog_meta',
    tbl_name: 'catalog_meta',
    sql: 'CREATE TABLE catalog_meta (\n    key   TEXT PRIMARY KEY NOT NULL,\n    value TEXT NOT NULL\n  )',
  },
  {
    type: 'table',
    name: 'catalog_translations',
    tbl_name: 'catalog_translations',
    sql: 'CREATE TABLE catalog_translations (\n    exercise_id  TEXT NOT NULL REFERENCES catalog_exercises(id) ON DELETE CASCADE,\n    language     TEXT NOT NULL,\n    name         TEXT NOT NULL,\n    name_search  TEXT NOT NULL,\n    instructions TEXT NOT NULL,\n    PRIMARY KEY (exercise_id, language)\n  )',
  },
  {
    type: 'table',
    name: 'exercises',
    tbl_name: 'exercises',
    sql: "CREATE TABLE exercises (\n    id                TEXT PRIMARY KEY NOT NULL,\n    external_id       INTEGER,\n    name              TEXT NOT NULL,\n    instructions      TEXT,\n    category          TEXT,\n    primary_muscles   TEXT NOT NULL DEFAULT '[]',\n    secondary_muscles TEXT NOT NULL DEFAULT '[]',\n    equipment         TEXT NOT NULL DEFAULT '[]',\n    image_url         TEXT,\n    source            TEXT NOT NULL DEFAULT 'remote',\n    captured_at       INTEGER NOT NULL\n  , thumbnail_url TEXT)",
  },
  {
    type: 'table',
    name: 'records',
    tbl_name: 'records',
    sql: 'CREATE TABLE records (\n    exercise_id    TEXT NOT NULL,\n    kind           TEXT NOT NULL,\n    exercise_name  TEXT NOT NULL,\n    value          REAL NOT NULL,\n    achieved_at    INTEGER NOT NULL,\n    PRIMARY KEY (exercise_id, kind)\n  )',
  },
  {
    type: 'table',
    name: 'routine_item_sets',
    tbl_name: 'routine_item_sets',
    sql: 'CREATE TABLE routine_item_sets (\n          item_id     TEXT NOT NULL REFERENCES routine_items (id) ON DELETE CASCADE,\n          position    INTEGER NOT NULL,\n          reps        INTEGER NOT NULL,\n          weight_kg   REAL NOT NULL,\n          target_rpe  REAL,\n          PRIMARY KEY (item_id, position)\n        )',
  },
  {
    type: 'table',
    name: 'routine_items',
    tbl_name: 'routine_items',
    sql: "CREATE TABLE routine_items (\n    id            TEXT PRIMARY KEY NOT NULL,\n    routine_id    TEXT NOT NULL REFERENCES routines (id) ON DELETE CASCADE,\n    exercise_id   TEXT NOT NULL REFERENCES exercises (id) ON DELETE RESTRICT,\n    position      INTEGER NOT NULL,\n    rest_seconds  INTEGER NOT NULL,\n    notes         TEXT\n  , exercise_name TEXT NOT NULL DEFAULT '')",
  },
  {
    type: 'table',
    name: 'routines',
    tbl_name: 'routines',
    sql: 'CREATE TABLE routines (\n    id               TEXT PRIMARY KEY NOT NULL,\n    name             TEXT NOT NULL,\n    created_at       INTEGER NOT NULL,\n    updated_at       INTEGER NOT NULL,\n    times_completed  INTEGER NOT NULL DEFAULT 0,\n    last_performed_at INTEGER)',
  },
  {
    type: 'table',
    name: 'sessions',
    tbl_name: 'sessions',
    sql: "CREATE TABLE sessions (\n    id                   TEXT PRIMARY KEY NOT NULL,\n    routine_id           TEXT,\n    routine_name         TEXT NOT NULL,\n    started_at           INTEGER NOT NULL,\n    elapsed_seconds      REAL NOT NULL DEFAULT 0,\n    status               TEXT NOT NULL,\n    entries_json         TEXT NOT NULL DEFAULT '[]',\n    active_index         INTEGER NOT NULL DEFAULT 0,\n    rest_ends_at         INTEGER,\n    rest_duration        INTEGER,\n    notes                TEXT,\n    updated_at           INTEGER NOT NULL\n  )",
  },
  {
    type: 'table',
    name: 'settings',
    tbl_name: 'settings',
    sql: 'CREATE TABLE settings (\n    key        TEXT PRIMARY KEY NOT NULL,\n    value_json TEXT NOT NULL,\n    updated_at INTEGER NOT NULL\n  )',
  },
];
