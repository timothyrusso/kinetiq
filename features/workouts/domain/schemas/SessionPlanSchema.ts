import { Schema } from 'effect';

/** What every planned set carries. */
const planSetFields = {
  // NOTE: 0 to 10, the RPE the set opens with; null for none.
  targetRpe: Schema.NullOr(Schema.Number),
};

/** A planned loaded set: reps at a weight, in kilograms; 0 is bodyweight. */
const WeightRepsPlanSetSchema = Schema.Struct({
  type: Schema.Literal('weightReps'),
  ...planSetFields,
  reps: Schema.Number,
  weightKg: Schema.Number,
});

/** A planned set counted in reps alone. */
const RepsOnlyPlanSetSchema = Schema.Struct({
  type: Schema.Literal('repsOnly'),
  ...planSetFields,
  reps: Schema.Number,
});

/** A planned timed set, in seconds. */
const DurationPlanSetSchema = Schema.Struct({
  type: Schema.Literal('duration'),
  ...planSetFields,
  durationSeconds: Schema.Number,
});

const planItemFields = {
  // NOTE: the routine item this is, so a finish can write the workout back into it.
  itemId: Schema.optional(Schema.String),
  exerciseId: Schema.String,
  exerciseName: Schema.String,
  restSeconds: Schema.Number,
  notes: Schema.NullOr(Schema.String),
};

/**
 * One exercise of a plan, with the targets its sets open with, in order, one per set the entry
 * opens with. A union on `trackingType`, each set tagged the same, as the session's entries are.
 */
const SessionPlanItemSchema = Schema.Union(
  Schema.Struct({
    trackingType: Schema.Literal('weightReps'),
    ...planItemFields,
    sets: Schema.Array(WeightRepsPlanSetSchema),
  }),
  Schema.Struct({
    trackingType: Schema.Literal('repsOnly'),
    ...planItemFields,
    sets: Schema.Array(RepsOnlyPlanSetSchema),
  }),
  Schema.Struct({
    trackingType: Schema.Literal('duration'),
    ...planItemFields,
    sets: Schema.Array(DurationPlanSetSchema),
  }),
);

export type SessionPlanItem = typeof SessionPlanItemSchema.Type;

export type SessionPlanSet = SessionPlanItem['sets'][number];

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
