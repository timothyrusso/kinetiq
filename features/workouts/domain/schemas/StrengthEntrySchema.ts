import { Schema } from 'effect';

/** What every set carries, whatever it records. */
const setFields = {
  index: Schema.Number,
  completed: Schema.Boolean,
  rpe: Schema.NullOr(Schema.Number),
  // NOTE: the routine set row this set was planned from; absent for a set added mid-workout.
  routineSetIndex: Schema.optional(Schema.Number),
};

/** A loaded set: reps at a weight, in kilograms. A bodyweight set of this type stores 0. */
const WeightRepsSetSchema = Schema.Struct({
  type: Schema.Literal('weightReps'),
  ...setFields,
  reps: Schema.Number,
  weightKg: Schema.Number,
  // NOTE: Epley, computed when the set is written; null when the set does not support it.
  estimated1rm: Schema.NullOr(Schema.Number),
});

export type WeightRepsSet = typeof WeightRepsSetSchema.Type;

/** A set counted in reps alone, with no load: a pull-up, a push-up. */
const RepsOnlySetSchema = Schema.Struct({
  type: Schema.Literal('repsOnly'),
  ...setFields,
  reps: Schema.Number,
});

export type RepsOnlySet = typeof RepsOnlySetSchema.Type;

/** A timed set: a plank, a bike, a stretch. */
const DurationSetSchema = Schema.Struct({
  type: Schema.Literal('duration'),
  ...setFields,
  durationSeconds: Schema.Number,
});

export type DurationSet = typeof DurationSetSchema.Type;

/** One set, tagged with what it records. */
export type StrengthSet = WeightRepsSet | RepsOnlySet | DurationSet;

/** What every entry carries besides its tracking type and its sets. */
const entryFields = {
  // NOTE: the exercise's id as the routine or the picker wrote it; its stored snapshot resolves it.
  exerciseId: Schema.String,
  exerciseName: Schema.String,
  // NOTE: only on rows written before snapshots were authoritative; every new entry stores null.
  muscleGroup: Schema.NullOr(Schema.String),
  // NOTE: the routine's cue for the exercise.
  notes: Schema.NullOr(Schema.String),
  // NOTE: the rest captured when the session started, in seconds.
  restSeconds: Schema.Number,
  // NOTE: the routine item the entry was planned from; absent for an exercise added mid-workout
  // and on every recorded workout.
  routineItemId: Schema.optional(Schema.String),
};

const WeightRepsEntrySchema = Schema.Struct({
  trackingType: Schema.Literal('weightReps'),
  ...entryFields,
  sets: Schema.Array(WeightRepsSetSchema),
});

const RepsOnlyEntrySchema = Schema.Struct({
  trackingType: Schema.Literal('repsOnly'),
  ...entryFields,
  sets: Schema.Array(RepsOnlySetSchema),
});

const DurationEntrySchema = Schema.Struct({
  trackingType: Schema.Literal('duration'),
  ...entryFields,
  sets: Schema.Array(DurationSetSchema),
});

/**
 * One exercise of a session or a recorded workout, with its sets. A union on `trackingType`, and
 * every set carries the same tag as its own `type`: a set of another type fails the decode, so an
 * entry can never hold sets it cannot draw or sum.
 */
export const StrengthEntrySchema = Schema.Union(WeightRepsEntrySchema, RepsOnlyEntrySchema, DurationEntrySchema);

export type StrengthEntry = typeof StrengthEntrySchema.Type;

/**
 * What an entry's sets record. The same literals as the exercises' `TrackingType`, which a domain
 * file may not import: the use cases and the store hand one to the other, so the compiler keeps
 * the two lists equal.
 */
export type TrackingType = StrengthEntry['trackingType'];

export type WeightRepsEntry = Extract<StrengthEntry, { readonly trackingType: 'weightReps' }>;

export type RepsOnlyEntry = Extract<StrengthEntry, { readonly trackingType: 'repsOnly' }>;

export type DurationEntry = Extract<StrengthEntry, { readonly trackingType: 'duration' }>;

/** An entry with no tracking type or sets: what every type's entry shares. */
export type EntryFields = Omit<StrengthEntry, 'trackingType' | 'sets'>;
