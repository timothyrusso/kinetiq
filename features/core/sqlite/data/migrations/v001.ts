import type { Migration } from '@timothyrusso/effect-core';

/** The first schema: every table the app shipped with. */
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

/** Creates the first schema. */
export const v001: Migration = {
  version: 1,
  up: async txn => {
    await txn.execAsync(SCHEMA_V1);
  },
};
