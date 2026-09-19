/**
 * Activity history repository. Owns every read/write of recorded activities.
 *
 * Lists deliberately read `route_simplified_json` instead of the full samples;
 * a 40-minute run is ~2400 points, and parsing all of them per row is how lists
 * drop frames.
 */
import { getDatabase } from './database';
import { encodeRoute, rowToActivity, stringify } from './codec';
import type { ActivityRow } from './rows';
import type {
  Activity,
  ActivityKind,
  ActivitySplit,
  CompletedWorkout,
  PersonalRecord,
  RoutePoint,
} from '@/domain/types';
import { completedSetCount, totalVolumeKg } from '@/domain/logic';
import { localId } from '@/utils/functional';

const LIST_COLUMNS = `
  id, kind, title, started_at, duration_seconds, calories_kcal, notes, seeded,
  source_session_id, distance_meters, avg_pace, avg_hr, max_hr, elevation_meters,
  avg_speed_mps, cadence, splits_json, route_simplified_json AS route_json,
  entries_json, volume_kg, total_sets, created_at`;

const FULL_COLUMNS = `
  id, kind, title, started_at, duration_seconds, calories_kcal, notes, seeded,
  source_session_id, distance_meters, avg_pace, avg_hr, max_hr, elevation_meters,
  avg_speed_mps, cadence, splits_json, route_json, entries_json, volume_kg,
  total_sets, created_at`;

export type ActivityListQuery = {
  /** Newest-first (default) or oldest-first. */
  order?: 'desc' | 'asc';
  kinds?: readonly Activity['kind'][];
  /** Case-insensitive substring match on title. */
  search?: string;
  from?: number;
  to?: number;
  limit?: number;
  offset?: number;
};

/** Strips characters that would change LIKE semantics when we have no escapes. */
function likeTerm(search: string): string {
  return `%${search.replace(/[\\%_]/g, ' ')}%`;
}

export const activityRepository = {
  async list(query: ActivityListQuery = {}): Promise<Activity[]> {
    const where: string[] = [];
    const args: (string | number)[] = [];

    if (query.kinds && query.kinds.length > 0) {
      where.push(`kind IN (${query.kinds.map(() => '?').join(', ')})`);
      args.push(...query.kinds);
    }
    if (query.search?.trim()) {
      where.push('title LIKE ?');
      args.push(likeTerm(query.search.trim()));
    }
    if (typeof query.from === 'number') {
      where.push('started_at >= ?');
      args.push(query.from);
    }
    if (typeof query.to === 'number') {
      where.push('started_at <= ?');
      args.push(query.to);
    }

    const direction = query.order === 'asc' ? 'ASC' : 'DESC';
    let sql = `SELECT ${LIST_COLUMNS} FROM activities`;
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
      `SELECT ${FULL_COLUMNS} FROM activities WHERE id = ?`,
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

  /** Seeding guard — refuses to re-seed over a database the user has used. */
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
    await getDatabase().runAsync(UPDATE_SQL, ...toParams(activity).slice(0, -1), activity.id);
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
      cardio: null,
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

  async recordCardio(input: {
    id?: string;
    kind: ActivityKind;
    title: string;
    startedAt: number;
    durationSeconds: number;
    distanceMeters: number;
    caloriesKcal: number;
    route: readonly RoutePoint[];
    avgHeartRate: number | null;
    maxHeartRate: number | null;
    elevationGainMeters: number;
    notes?: string | null;
    splits: readonly ActivitySplit[];
  }): Promise<Activity> {
    const secondsPerKm =
      input.distanceMeters > 0 ? input.durationSeconds / (input.distanceMeters / 1000) : 0;
    const activity: Activity = {
      id: input.id ?? localId('act'),
      kind: input.kind,
      title: input.title,
      startedAt: input.startedAt,
      durationSeconds: input.durationSeconds,
      caloriesKcal: input.caloriesKcal,
      notes: input.notes ?? null,
      seeded: false,
      sourceSessionId: null,
      cardio: {
        distanceMeters: input.distanceMeters,
        avgPaceSecPerKm: secondsPerKm,
        avgHeartRate: input.avgHeartRate,
        maxHeartRate: input.maxHeartRate,
        elevationGainMeters: input.elevationGainMeters,
        avgSpeedMps: input.durationSeconds > 0 ? input.distanceMeters / input.durationSeconds : null,
        stridesPerMinute: null,
        splits: [...input.splits],
        route: [...input.route],
      },
      strength: null,
    };
    await this.insert(activity);
    return activity;
  },
};

const INSERT_SQL = `
  INSERT OR REPLACE INTO activities (
    id, kind, title, started_at, duration_seconds, calories_kcal, notes, seeded,
    source_session_id, distance_meters, avg_pace, avg_hr, max_hr, elevation_meters,
    avg_speed_mps, cadence, splits_json, route_json, route_simplified_json,
    entries_json, volume_kg, total_sets, created_at
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

const UPDATE_SQL = `
  UPDATE activities SET
    kind = ?, title = ?, started_at = ?, duration_seconds = ?, calories_kcal = ?,
    notes = ?, seeded = ?, source_session_id = ?, distance_meters = ?, avg_pace = ?,
    avg_hr = ?, max_hr = ?, elevation_meters = ?, avg_speed_mps = ?, cadence = ?,
    splits_json = ?, route_json = ?, route_simplified_json = ?, entries_json = ?,
    volume_kg = ?, total_sets = ?, created_at = ?
  WHERE id = ?`;

function toParams(a: Activity): (string | number | null)[] {
  const route = a.cardio?.route ?? [];
  const encoded = route.length > 0 ? encodeRoute(route) : { full: null, simplified: null };
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
    a.cardio ? a.cardio.distanceMeters : null,
    a.cardio ? a.cardio.avgPaceSecPerKm : null,
    a.cardio?.avgHeartRate ?? null,
    a.cardio?.maxHeartRate ?? null,
    a.cardio ? a.cardio.elevationGainMeters : null,
    a.cardio?.avgSpeedMps ?? null,
    a.cardio?.stridesPerMinute ?? null,
    a.cardio ? stringify(a.cardio.splits) : null,
    encoded.full,
    encoded.simplified,
    a.strength ? stringify(a.strength.entries) : null,
    a.strength ? a.strength.totalVolumeKg : null,
    a.strength ? a.strength.totalSets : null,
    a.startedAt,
  ];
}
