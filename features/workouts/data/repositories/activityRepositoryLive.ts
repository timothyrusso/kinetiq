import { Effect, Layer } from 'effect';
import { SqliteClient, trySql } from '@/features/core/sqlite';
import {
  ACTIVITY_COLUMNS,
  ActivityRow,
  activityFromRow,
  activityToRow,
} from '@/features/workouts/data/adapters/activityRows';
import { decodeRows } from '@/features/workouts/data/adapters/decodeRows';
import type { ActivityListQuery } from '@/features/workouts/domain/entities/ActivityListQuery';
import { ActivityRepository } from '@/features/workouts/domain/repositories/ActivityRepository';
import type { Activity } from '@/features/workouts/domain/schemas/ActivitySchema';
import { completedSetCount, totalVolumeKg } from '@/features/workouts/domain/utils/workoutMath';

const decodeActivities = decodeRows(ActivityRow, 'activities');

const INSERT_ACTIVITY = `
  INSERT OR REPLACE INTO activities (
    id, kind, title, started_at, duration_seconds, notes,
    source_session_id, entries_json, volume_kg, total_sets, created_at
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

/** The title a workout with a blank one is stored under. Stored, so it is not translated. */
const UNTITLED = 'Strength session';

/** The list statement for `query` and its bound values. */
function listStatement(query: ActivityListQuery): { sql: string; args: (string | number)[] } {
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
  let sql = `SELECT ${ACTIVITY_COLUMNS} FROM activities`;
  if (where.length > 0) sql += ` WHERE ${where.join(' AND ')}`;
  sql += ` ORDER BY started_at ${direction}, id ${direction}`;
  if (typeof query.limit === 'number') sql += ` LIMIT ${Math.max(0, Math.floor(query.limit))}`;
  if (typeof query.offset === 'number') sql += ` OFFSET ${Math.max(0, Math.floor(query.offset))}`;
  return { sql, args };
}

/** The recorded workouts in the app database's `activities` table. */
export const ActivityRepositoryLive = Layer.effect(
  ActivityRepository,
  Effect.gen(function* () {
    const db = yield* SqliteClient;
    return {
      list: (query = {}) => {
        const { sql, args } = listStatement(query);
        return trySql('list workouts', () => db.getAllAsync<unknown>(sql, args)).pipe(
          Effect.flatMap(decodeActivities),
          Effect.map(rows => rows.map(activityFromRow)),
        );
      },

      byId: id =>
        trySql('read a workout', () =>
          db.getAllAsync<unknown>(`SELECT ${ACTIVITY_COLUMNS} FROM activities WHERE id = ?`, [id]),
        ).pipe(
          Effect.flatMap(decodeActivities),
          Effect.map(([row]) => (row === undefined ? undefined : activityFromRow(row))),
        ),

      count: trySql('count workouts', () =>
        db.getFirstAsync<{ n: number }>('SELECT COUNT(*) AS n FROM activities'),
      ).pipe(Effect.map(row => row?.n ?? 0)),

      remove: id =>
        trySql('delete a workout', () => db.runAsync('DELETE FROM activities WHERE id = ?', [id])).pipe(Effect.asVoid),

      recordWorkout: (workout, records) => {
        const activity: Activity = {
          id: workout.id,
          kind: 'lift',
          title: workout.title.trim() || UNTITLED,
          startedAt: workout.startedAt,
          durationSeconds: workout.durationSeconds,
          notes: workout.notes,
          sourceSessionId: workout.id,
          strength: {
            entries: workout.entries,
            totalVolumeKg: totalVolumeKg(workout.entries),
            totalSets: completedSetCount(workout.entries),
            personalRecords: [...records],
          },
        };
        return trySql('record a workout', () => db.runAsync(INSERT_ACTIVITY, activityToRow(activity))).pipe(
          Effect.as(activity),
        );
      },
    };
  }),
);
