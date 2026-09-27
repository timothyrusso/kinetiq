import { Schema } from 'effect';

/** One planned set. Kilograms; a bodyweight set stores 0 and reads as bodyweight. */
export const StrengthSetSchema = Schema.Struct({
  index: Schema.Number,
  reps: Schema.Number,
  weightKg: Schema.Number,
  completed: Schema.Boolean,
  // NOTE: Epley, computed when the set is written; null when the set does not support it.
  estimated1rm: Schema.NullOr(Schema.Number),
  rpe: Schema.NullOr(Schema.Number),
});

export type StrengthSet = typeof StrengthSetSchema.Type;

/** One exercise of a session or a recorded workout, with its sets. */
export const StrengthEntrySchema = Schema.Struct({
  // NOTE: the exercise's id as the routine or the picker wrote it; its stored snapshot resolves it.
  exerciseId: Schema.String,
  exerciseName: Schema.String,
  // NOTE: only on rows written before snapshots were authoritative; every new entry stores null.
  muscleGroup: Schema.NullOr(Schema.String),
  sets: Schema.Array(StrengthSetSchema),
  // NOTE: the routine's cue for the exercise.
  notes: Schema.NullOr(Schema.String),
  // NOTE: the rest captured when the session started, in seconds.
  restSeconds: Schema.Number,
});

export type StrengthEntry = typeof StrengthEntrySchema.Type;
