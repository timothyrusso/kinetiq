/**
 * Personal records. The settings half moved to `features/settings`.
 */
import { getDatabase } from './database';
import type { RecordRow } from './rows';
import type { PersonalRecord, PersonalRecordKind } from '@/domain/types';

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
};
