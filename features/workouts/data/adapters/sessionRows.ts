import { Schema } from 'effect';
import { entriesFromColumn, entriesToColumn } from '@/features/workouts/data/adapters/decodeRows';
import { ActivityId } from '@/features/workouts/domain/schemas/ActivityId';
import {
  type WorkoutSession,
  WorkoutSessionStatusSchema,
} from '@/features/workouts/domain/schemas/WorkoutSessionSchema';

/** The `sessions` columns every read selects. */
export const SESSION_SELECT = `
  SELECT id, routine_id, routine_name, started_at, elapsed_seconds, status,
         entries_json, active_index, rest_ends_at, rest_duration, notes, updated_at
  FROM sessions`;

/** A row of the `sessions` table. */
export const SessionRow = Schema.Struct({
  id: ActivityId,
  routine_id: Schema.NullOr(Schema.String),
  routine_name: Schema.String,
  started_at: Schema.Number,
  elapsed_seconds: Schema.Number,
  status: Schema.String,
  entries_json: Schema.String,
  active_index: Schema.Number,
  rest_ends_at: Schema.NullOr(Schema.Number),
  rest_duration: Schema.NullOr(Schema.Number),
  notes: Schema.NullOr(Schema.String),
  updated_at: Schema.Number,
});

const isStatus = Schema.is(WorkoutSessionStatusSchema);

/** A stored row as a session. A status the app does not know reads as `active`, so it restores. */
export function sessionFromRow(row: typeof SessionRow.Type): WorkoutSession {
  return {
    id: row.id,
    routineId: row.routine_id,
    routineName: row.routine_name,
    startedAt: row.started_at,
    elapsedSeconds: row.elapsed_seconds,
    status: isStatus(row.status) ? row.status : 'active',
    entries: entriesFromColumn(row.entries_json),
    activeIndex: row.active_index,
    restEndsAt: row.rest_ends_at,
    restDurationSeconds: row.rest_duration,
    notes: row.notes,
    updatedAt: row.updated_at,
  };
}

/** The bound values of the session upsert, in its column order. */
export function sessionToRow(session: WorkoutSession): (string | number | null)[] {
  return [
    session.id,
    session.routineId,
    session.routineName,
    session.startedAt,
    session.elapsedSeconds,
    session.status,
    entriesToColumn(session.entries),
    session.activeIndex,
    session.restEndsAt,
    session.restDurationSeconds,
    session.notes,
    session.updatedAt,
  ];
}
