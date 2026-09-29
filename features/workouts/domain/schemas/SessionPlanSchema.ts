import { Schema } from 'effect';

/** One planned set: the reps, load and effort target the workout's set opens with. */
const SessionPlanSetSchema = Schema.Struct({
  reps: Schema.Number,
  // NOTE: kilograms; 0 is bodyweight.
  weightKg: Schema.Number,
  // NOTE: 0 to 10, the RPE the set opens with; null for none.
  targetRpe: Schema.NullOr(Schema.Number),
});

/** One exercise of a plan, with the targets its sets open with. */
const SessionPlanItemSchema = Schema.Struct({
  // NOTE: the routine item this is, so a finish can write the workout back into it.
  itemId: Schema.optional(Schema.String),
  exerciseId: Schema.String,
  exerciseName: Schema.String,
  // NOTE: in order, one per set the entry opens with.
  sets: Schema.Array(SessionPlanSetSchema),
  restSeconds: Schema.Number,
  notes: Schema.NullOr(Schema.String),
});

export type SessionPlanItem = typeof SessionPlanItemSchema.Type;

export type SessionPlanSet = typeof SessionPlanSetSchema.Type;

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
