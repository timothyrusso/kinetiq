import { Effect, Schema } from 'effect';
import { DecodeError } from '@/features/core/error';
import { RoutineId } from '@/features/routines/domain/schemas/RoutineId';
import type { Routine } from '@/features/routines/domain/schemas/RoutineSchema';

/** A row of the `routines` table. */
const RoutineRow = Schema.Struct({
  id: RoutineId,
  name: Schema.String,
  created_at: Schema.Number,
  updated_at: Schema.Number,
  times_completed: Schema.Number,
  last_performed_at: Schema.NullOr(Schema.Number),
});

/** A row of the `routine_items` table. */
const RoutineItemRow = Schema.Struct({
  id: Schema.String,
  routine_id: Schema.String,
  exercise_id: Schema.String,
  position: Schema.Number,
  sets: Schema.Number,
  reps: Schema.String,
  weight_kg: Schema.Number,
  rest_seconds: Schema.Number,
  notes: Schema.NullOr(Schema.String),
  exercise_name: Schema.String,
});

type RoutineRow = typeof RoutineRow.Type;
type RoutineItemRow = typeof RoutineItemRow.Type;

const decode =
  <A, I>(schema: Schema.Schema<A, I>, table: string) =>
  (rows: unknown): Effect.Effect<readonly A[], DecodeError> =>
    Schema.decodeUnknown(Schema.Array(schema))(rows).pipe(
      Effect.mapError(cause => new DecodeError({ source: table, cause })),
    );

export const decodeRoutineRows = decode(RoutineRow, 'routines');

export const decodeRoutineItemRows = decode(RoutineItemRow, 'routine_items');

/**
 * A routine row with its item rows, the items in position order. The item's own name is the one
 * shown; an item stored before items carried a name reads `Unknown exercise`.
 */
export function routineFromRows(row: RoutineRow, items: readonly RoutineItemRow[]): Routine {
  return {
    id: row.id,
    name: row.name,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    timesCompleted: row.times_completed,
    lastPerformedAt: row.last_performed_at,
    items: [...items]
      .sort((a, b) => a.position - b.position)
      .map(item => ({
        id: item.id,
        exerciseId: item.exercise_id,
        exerciseName: item.exercise_name || 'Unknown exercise',
        sets: item.sets,
        reps: item.reps,
        weightKg: item.weight_kg,
        restSeconds: item.rest_seconds,
        notes: item.notes,
      })),
  };
}

/** Routine rows with every item row, each routine taking the items that name it. */
export function routinesFromRows(rows: readonly RoutineRow[], items: readonly RoutineItemRow[]): Routine[] {
  const byRoutine = new Map<string, RoutineItemRow[]>();
  for (const item of items) {
    const bucket = byRoutine.get(item.routine_id);
    if (bucket) bucket.push(item);
    else byRoutine.set(item.routine_id, [item]);
  }
  return rows.map(row => routineFromRows(row, byRoutine.get(row.id) ?? []));
}
