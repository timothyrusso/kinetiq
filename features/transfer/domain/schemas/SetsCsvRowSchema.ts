import { Schema } from 'effect';

/**
 * One row of the sets CSV: one per set, because the set is the smallest fact every other number
 * is a sum of, so it is the table every pivot can be built from. The field order is the column
 * order, and the field names are the header. A value the set's type does not record is an empty
 * cell, not a zero: a plank has no reps and a pull-up no weight, which a 0 would average in.
 */
export const SetsCsvRowSchema = Schema.Struct({
  workout_id: Schema.String,
  started_at: Schema.String,
  workout: Schema.String,
  exercise_id: Schema.String,
  exercise: Schema.String,
  muscle_group: Schema.NullOr(Schema.String),
  // NOTE: what the set records: `weightReps`, `repsOnly` or `duration`.
  type: Schema.Literal('weightReps', 'repsOnly', 'duration'),
  // NOTE: numbered from 1, as a person counts sets.
  set: Schema.Number,
  reps: Schema.NullOr(Schema.Number),
  weight_kg: Schema.NullOr(Schema.Number),
  duration_seconds: Schema.NullOr(Schema.Number),
  completed: Schema.Boolean,
  rpe: Schema.NullOr(Schema.Number),
  // NOTE: to one decimal; loaded sets only.
  e1rm_kg: Schema.NullOr(Schema.Number),
});

export type SetsCsvRow = typeof SetsCsvRowSchema.Type;

/** The CSV's columns, in order. */
export const SETS_CSV_COLUMNS = Object.keys(SetsCsvRowSchema.fields) as (keyof SetsCsvRow)[];
