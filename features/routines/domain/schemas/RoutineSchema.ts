import { Schema } from 'effect';
import { RoutineId } from '@/features/routines/domain/schemas/RoutineId';

/** One exercise in a routine, with the targets a workout started from it opens with. */
const RoutineItemSchema = Schema.Struct({
  id: Schema.String,
  exerciseId: Schema.String,
  // NOTE: stored on the item itself, so a routine still reads correctly when the exercise's
  // snapshot is gone, or was never stored.
  exerciseName: Schema.String,
  sets: Schema.Number,
  // NOTE: a number or a range, `8` or `8-12`.
  reps: Schema.String,
  // NOTE: kilograms; 0 is bodyweight.
  weightKg: Schema.Number,
  restSeconds: Schema.Number,
  // NOTE: the cue shown on the exercise mid-workout.
  notes: Schema.NullOr(Schema.String),
});

/** A saved routine: a named, ordered plan of exercises, and how often it has been trained. */
export const RoutineSchema = Schema.Struct({
  id: RoutineId,
  name: Schema.String,
  // NOTE: in the order the plan runs.
  items: Schema.Array(RoutineItemSchema),
  createdAt: Schema.Number,
  updatedAt: Schema.Number,
  // NOTE: how many recorded workouts came from this routine.
  timesCompleted: Schema.Number,
  lastPerformedAt: Schema.NullOr(Schema.Number),
});

export type Routine = typeof RoutineSchema.Type;

export type RoutineItem = typeof RoutineItemSchema.Type;
