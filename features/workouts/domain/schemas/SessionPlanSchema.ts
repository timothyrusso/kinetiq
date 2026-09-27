import { Schema } from 'effect';

/** One exercise of a plan, with the targets its sets open with. */
const SessionPlanItemSchema = Schema.Struct({
  exerciseId: Schema.String,
  exerciseName: Schema.String,
  sets: Schema.Number,
  // NOTE: a number or a range, `8` or `8-12`; the sets open on the number the range starts with.
  reps: Schema.String,
  // NOTE: kilograms; 0 is bodyweight.
  weightKg: Schema.Number,
  restSeconds: Schema.Number,
  notes: Schema.NullOr(Schema.String),
});

export type SessionPlanItem = typeof SessionPlanItemSchema.Type;

/**
 * What a session starts from: a name and the exercises to train, in order. Owned here so a
 * workout never needs the routine it came from: the caller that has a routine maps it to a plan.
 */
export const SessionPlanSchema = Schema.Struct({
  // NOTE: the routine the plan came from, counted as trained when the workout is recorded.
  routineId: Schema.NullOr(Schema.String),
  name: Schema.String,
  items: Schema.Array(SessionPlanItemSchema),
});

export type SessionPlan = typeof SessionPlanSchema.Type;
