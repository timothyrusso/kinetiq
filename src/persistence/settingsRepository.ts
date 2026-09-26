/**
 * Settings, personal records and app bookkeeping.
 *
 * Settings are one typed key per row rather than a blob: a single malformed row
 * then degrades one preference instead of resetting everything, and a future
 * schema migration only has to know about the keys it cares about.
 */
import { getDatabase } from './database';
import { stringify } from './codec';
import type { RecordRow, SettingsRow } from './rows';
import type { PersonalRecord, PersonalRecordKind } from '@/domain/types';

export const SETTING_KEYS = {
  unitSystem: 'settings.units',
  themeMode: 'settings.theme',
  accentColor: 'settings.accentColor',
  language: 'settings.language',
  haptics: 'settings.haptics',
  restCountdownHaptics: 'settings.restCountdownHaptics',
  keepScreenAwake: 'settings.keepScreenAwake',
  notifications: 'settings.notifications',
  defaultRestSeconds: 'settings.defaultRestSeconds',
  weeklyGoalWorkouts: 'settings.weeklyGoalWorkouts',
  autoStartRest: 'settings.autoStartRest',
  profile: 'settings.profile',
  reminder: 'settings.reminder',
  seededAt: 'app.seededAt',
} as const;

export type SettingKey = (typeof SETTING_KEYS)[keyof typeof SETTING_KEYS];

export async function setSetting<T>(key: SettingKey, value: T): Promise<void> {
  await getDatabase().runAsync(
    `INSERT INTO settings (key, value_json, updated_at) VALUES (?, ?, ?)
     ON CONFLICT(key) DO UPDATE SET value_json = excluded.value_json,
                                    updated_at = excluded.updated_at`,
    key,
    stringify(value),
    Date.now(),
  );
}

/** Bulk read for the bootstrap, which loads every preference in one round trip. */
export async function readAllSettings(
  keys: readonly SettingKey[],
): Promise<Map<SettingKey, unknown>> {
  if (keys.length === 0) return new Map();
  const rows = await getDatabase().getAllAsync<SettingsRow>(
    `SELECT key, value_json, updated_at FROM settings
     WHERE key IN (${keys.map(() => '?').join(', ')})`,
    ...keys,
  );
  const out = new Map<SettingKey, unknown>();
  for (const row of rows) {
    try {
      out.set(row.key as SettingKey, JSON.parse(row.value_json) as unknown);
    } catch {
      /* unparseable row: treated as unset, so the default applies */
    }
  }
  return out;
}

/* --------------------------------------------------------------- records -- */

const RECORD_TOLERANCE = 1e-6;

function sameValue(a: number, b: number): boolean {
  return Math.abs(a - b) < RECORD_TOLERANCE;
}

/**
 * Writes `candidate` if it beats (or equals, more recently) the stored best. Returns the value
 * it displaced, or null when it lost. Opens no transaction; callers decide.
 */
async function upsertRecord(candidate: PersonalRecord): Promise<number | null> {
  const db = getDatabase();
  const existing = await db.getFirstAsync<RecordRow>(
    'SELECT exercise_id, kind, exercise_name, value, achieved_at FROM records WHERE exercise_id = ? AND kind = ?',
    candidate.exerciseId,
    candidate.kind,
  );

  if (existing && existing.value > candidate.value + RECORD_TOLERANCE) return null;

  if (existing && sameValue(existing.value, candidate.value)) {
    // Same number: only re-date it when this attempt is the more recent one.
    if (candidate.achievedAt > existing.achieved_at) {
      await db.runAsync(
        'UPDATE records SET achieved_at = ? WHERE exercise_id = ? AND kind = ?',
        candidate.achievedAt,
        candidate.exerciseId,
        candidate.kind,
      );
    }
    return existing.value;
  }

  await db.runAsync(
    `INSERT INTO records (exercise_id, kind, exercise_name, value, achieved_at)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(exercise_id, kind) DO UPDATE SET
       exercise_name = excluded.exercise_name,
       value = excluded.value,
       achieved_at = excluded.achieved_at`,
    candidate.exerciseId,
    candidate.kind,
    candidate.exerciseName,
    candidate.value,
    candidate.achievedAt,
  );
  return existing?.value ?? null;
}

/**
 * `records` holds the current best per (exercise, kind). Updating is a compare,
 * not an overwrite, so replaying an older workout cannot silently downgrade a PR.
 */
export const recordRepository = {
  async all(): Promise<PersonalRecord[]> {
    const rows = await getDatabase().getAllAsync<RecordRow>(
      'SELECT exercise_id, kind, exercise_name, value, achieved_at FROM records ORDER BY achieved_at DESC',
    );
    return rows.map((row) => ({
      exerciseId: row.exercise_id,
      exerciseName: row.exercise_name,
      kind: row.kind as PersonalRecordKind,
      value: row.value,
      achievedAt: row.achieved_at,
      previousValue: null,
    }));
  },

  async forExercise(exerciseId: string): Promise<PersonalRecord[]> {
    const rows = await getDatabase().getAllAsync<RecordRow>(
      `SELECT exercise_id, kind, exercise_name, value, achieved_at FROM records
       WHERE exercise_id = ? ORDER BY kind`,
      exerciseId,
    );
    return rows.map((row) => ({
      exerciseId: row.exercise_id,
      exerciseName: row.exercise_name,
      kind: row.kind as PersonalRecordKind,
      value: row.value,
      achievedAt: row.achieved_at,
      previousValue: null,
    }));
  },

  /** Best current values as a map, for the "previous performance" readout. */
  async asMap(): Promise<Map<string, PersonalRecord>> {
    const all = await this.all();
    const map = new Map<string, PersonalRecord>();
    for (const record of all) map.set(`${record.exerciseId}:${record.kind}`, record);
    return map;
  },

  /**
   * Commits a candidate PR. Returns the value it displaced when the candidate
   * actually won, so callers can show "previous: 80 kg" without a second read.
   */
  async commit(candidate: PersonalRecord): Promise<number | null> {
    // Transaction callbacks return void, so the displaced value is captured
    // rather than returned.
    let displaced: number | null = null;
    await getDatabase().withExclusiveTransactionAsync(async () => {
      displaced = await upsertRecord(candidate);
    });
    return displaced;
  },

  async commitMany(records: readonly PersonalRecord[]): Promise<number> {
    let committed = 0;
    for (const record of records) {
      if ((await this.commit(record)) !== null) committed += 1;
    }
    return committed;
  },

  /**
   * The same comparison as `commitMany`, without opening a transaction of its own: for a caller
   * that already holds one (`commitWorkout`), so the records land or roll back with the workout.
   */
  async commitManyInTransaction(records: readonly PersonalRecord[]): Promise<void> {
    for (const record of records) await upsertRecord(record);
  },

  /** Rebuilds every record from history; used by "reset & recompute" maintenance. */
  async replaceAll(records: readonly PersonalRecord[]): Promise<void> {
    const db = getDatabase();
    await db.withExclusiveTransactionAsync(async () => {
      await db.execAsync('DELETE FROM records;');
      for (const record of records) {
        await db.runAsync(
          `INSERT INTO records (exercise_id, kind, exercise_name, value, achieved_at)
           VALUES (?, ?, ?, ?, ?)
           ON CONFLICT(exercise_id, kind) DO UPDATE SET
             value = MAX(records.value, excluded.value),
             achieved_at = excluded.achieved_at`,
          record.exerciseId,
          record.kind,
          record.exerciseName,
          record.value,
          record.achievedAt,
        );
      }
    });
  },
};

/* ------------------------------------------------------------ app_state -- */

/**
 * Set once the first-run seed has had its one chance. Without it an emptied database looks
 * like a fresh install, and "Erase all Kinetiq data" would be undone by the next launch.
 */
export const SEED_DONE_KEY = 'seed.done';

/** Free-form machine state (last seen schema, dismissals, queue markers). */
export async function readState<T>(key: string, fallback: T): Promise<T> {
  const row = await getDatabase().getFirstAsync<{ value_json: string }>(
    'SELECT value_json FROM app_state WHERE key = ?',
    key,
  );
  if (!row) return fallback;
  try {
    return JSON.parse(row.value_json) as T;
  } catch {
    return fallback;
  }
}

export async function writeState<T>(key: string, value: T): Promise<void> {
  await getDatabase().runAsync(
    `INSERT INTO app_state (key, value_json) VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value_json = excluded.value_json`,
    key,
    stringify(value),
  );
}
