import { Option, Schema } from 'effect';
import { entriesFromColumn, entriesFromList, entriesToColumn } from '@/features/workouts/data/adapters/decodeRows';
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

/**
 * The `entries_json` of a session started from a routine: its entries beside the routine items it
 * started with. Any other session stores the plain list, as every row before it did.
 */
const PlannedColumnSchema = Schema.parseJson(
  Schema.Struct({ entries: Schema.Array(Schema.Unknown), routineItemIds: Schema.Array(Schema.String) }),
);

const decodePlannedColumn = Schema.decodeUnknownOption(PlannedColumnSchema);

/** A session's stored entries, and the routine items it started with when it stored them. */
function plannedFromColumn(raw: string): Pick<WorkoutSession, 'entries' | 'routineItemIds'> {
  const planned = decodePlannedColumn(raw);
  if (Option.isNone(planned)) return { entries: entriesFromColumn(raw) };
  return { entries: entriesFromList(planned.value.entries), routineItemIds: planned.value.routineItemIds };
}

function plannedToColumn(session: WorkoutSession): string {
  const { entries, routineItemIds } = session;
  return routineItemIds === undefined ? entriesToColumn(entries) : JSON.stringify({ entries, routineItemIds });
}

/** A stored row as a session. A status the app does not know reads as `active`, so it restores. */
export function sessionFromRow(row: typeof SessionRow.Type): WorkoutSession {
  return {
    id: row.id,
    routineId: row.routine_id,
    routineName: row.routine_name,
    startedAt: row.started_at,
    elapsedSeconds: row.elapsed_seconds,
    status: isStatus(row.status) ? row.status : 'active',
    ...plannedFromColumn(row.entries_json),
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
    plannedToColumn(session),
    session.activeIndex,
    session.restEndsAt,
    session.restDurationSeconds,
    session.notes,
    session.updatedAt,
  ];
}
