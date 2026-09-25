/** Activity history repository. Owns every read/write of recorded workouts. */
import { getDatabase } from './database';
import { rowToActivity, stringify } from './codec';
import type { ActivityRow } from './rows';
import type { Activity, CompletedWorkout, PersonalRecord } from '@/domain/types';
import { completedSetCount, totalVolumeKg } from '@/domain/logic';

const COLUMNS = `
  id, kind, title, started_at, duration_seconds, calories_kcal, notes, seeded,
  source_session_id, entries_json, volume_kg, total_sets, created_at`;

export type ActivityListQuery = {
  /** Newest-first (default) or oldest-first. */
  order?: 'desc' | 'asc';
  from?: number;
  to?: number;
  limit?: number;
  offset?: number;
};

export const activityRepository = {
  async list(query: ActivityListQuery = {}): Promise<Activity[]> {
    const where: string[] = [];
    const args: (string | number)[] = [];

    if (typeof query.from === 'number') {
      where.push('started_at >= ?');
      args.push(query.from);
    }
    if (typeof query.to === 'number') {
      where.push('started_at <= ?');
      args.push(query.to);
    }

    const direction = query.order === 'asc' ? 'ASC' : 'DESC';
    let sql = `SELECT ${COLUMNS} FROM activities`;
    if (where.length > 0) sql += ` WHERE ${where.join(' AND ')}`;
    sql += ` ORDER BY started_at ${direction}, id ${direction}`;
    if (typeof query.limit === 'number') sql += ` LIMIT ${Math.max(0, Math.floor(query.limit))}`;
    if (typeof query.offset === 'number') {
      sql += ` OFFSET ${Math.max(0, Math.floor(query.offset))}`;
    }

    const rows = await getDatabase().getAllAsync<ActivityRow>(sql, ...args);
    return rows.map(rowToActivity);
  },

  async byId(id: string): Promise<Activity | null> {
    const row = await getDatabase().getFirstAsync<ActivityRow>(
      `SELECT ${COLUMNS} FROM activities WHERE id = ?`,
      id,
    );
    return row ? rowToActivity(row) : null;
  },

  /** Lightweight existence check used by progress screens to pick empty state. */
  async count(): Promise<number> {
    const row = await getDatabase().getFirstAsync<{ n: number }>(
      'SELECT COUNT(*) AS n FROM activities',
    );
    return row?.n ?? 0;
  },

  /** Seeding guard: refuses to re-seed over a database the user has used. */
  async isEmpty(): Promise<boolean> {
    return (await this.count()) === 0;
  },

  async insertMany(activities: readonly Activity[]): Promise<void> {
    if (activities.length === 0) return;
    const db = getDatabase();
    await db.withExclusiveTransactionAsync(async () => {
      for (const activity of activities) {
        await db.runAsync(INSERT_SQL, ...toParams(activity));
      }
    });
  },

  async insert(activity: Activity): Promise<void> {
    await getDatabase().runAsync(INSERT_SQL, ...toParams(activity));
  },

  async update(activity: Activity): Promise<void> {
    // `toParams` is ordered for `INSERT_SQL`, whose *first* column is `id`. This statement
    // writes the other 12 columns and matches on that leading value, so the id has to travel
    // to the end of the argument list, `slice(0, -1)` is the trap: it drops `created_at`,
    // keeps `id`, and every value then binds one column early. `kind` receives
    // `seed_mu9sy8cm1u86sez`, the `NOT NULL` check refuses it, and the row is never written.
    const [, ...written] = toParams(activity);
    await getDatabase().runAsync(UPDATE_SQL, ...written, activity.id);
  },

  async remove(id: string): Promise<void> {
    await getDatabase().runAsync('DELETE FROM activities WHERE id = ?', id);
  },

  /**
   * Converts a finished session into history. `records` are the PRs detected
   * against prior history, computed by the caller so this layer stays free of
   * domain policy.
   */
  async recordWorkout(
    workout: CompletedWorkout,
    records: readonly PersonalRecord[] = [],
  ): Promise<Activity> {
    const title = workout.title.trim() || 'Strength session';
    const activity: Activity = {
      id: workout.id,
      kind: 'lift',
      title,
      startedAt: workout.startedAt,
      durationSeconds: workout.durationSeconds,
      caloriesKcal: workout.caloriesKcal,
      notes: workout.notes,
      seeded: false,
      sourceSessionId: workout.id,
      strength: {
        entries: workout.entries,
        totalVolumeKg: totalVolumeKg(workout.entries),
        totalSets: completedSetCount(workout.entries),
        personalRecords: [...records],
      },
    };
    await this.insert(activity);
    return activity;
  },

};

const INSERT_SQL = `
  INSERT OR REPLACE INTO activities (
    id, kind, title, started_at, duration_seconds, calories_kcal, notes, seeded,
    source_session_id, entries_json, volume_kg, total_sets, created_at
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

const UPDATE_SQL = `
  UPDATE activities SET
    kind = ?, title = ?, started_at = ?, duration_seconds = ?, calories_kcal = ?,
    notes = ?, seeded = ?, source_session_id = ?, entries_json = ?, volume_kg = ?,
    total_sets = ?, created_at = ?
  WHERE id = ?`;

function toParams(a: Activity): (string | number | null)[] {
  return [
    a.id,
    a.kind,
    a.title,
    a.startedAt,
    a.durationSeconds,
    a.caloriesKcal,
    a.notes,
    a.seeded ? 1 : 0,
    a.sourceSessionId,
    a.strength ? stringify(a.strength.entries) : null,
    a.strength ? a.strength.totalVolumeKg : null,
    a.strength ? a.strength.totalSets : null,
    a.startedAt,
  ];
}
