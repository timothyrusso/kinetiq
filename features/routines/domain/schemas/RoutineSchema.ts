import { Schema } from 'effect';
import { RoutineId } from '@/features/routines/domain/schemas/RoutineId';

/** What every planned set carries, whatever it records. */
const setFields = {
  // NOTE: 0-based, the set's place in the item.
  index: Schema.Int,
  // NOTE: 0 to 10; null when the set has no effort target.
  targetRpe: Schema.NullOr(Schema.Number.pipe(Schema.between(0, 10))),
};

/** A planned loaded set: reps at a weight. */
const WeightRepsRoutineSetSchema = Schema.Struct({
  type: Schema.Literal('weightReps'),
  ...setFields,
  reps: Schema.Int,
  // NOTE: kilograms; 0 is bodyweight.
  weightKg: Schema.Number,
});

/** A planned set counted in reps alone. */
const RepsOnlyRoutineSetSchema = Schema.Struct({
  type: Schema.Literal('repsOnly'),
  ...setFields,
  reps: Schema.Int,
});

/** A planned timed set. */
const DurationRoutineSetSchema = Schema.Struct({
  type: Schema.Literal('duration'),
  ...setFields,
  durationSeconds: Schema.Int,
});

/** What every item carries besides its tracking type and its sets. */
const itemFields = {
  id: Schema.String,
  exerciseId: Schema.String,
  // NOTE: stored on the item itself, so a routine still reads correctly when the exercise's
  // snapshot is gone, or was never stored.
  exerciseName: Schema.String,
  // NOTE: one rest for every set of the exercise.
  restSeconds: Schema.Number,
  // NOTE: the cue shown on the exercise mid-workout.
  notes: Schema.NullOr(Schema.String),
};

/**
 * One exercise in a routine, with the targets a workout started from it opens with: one set per
 * planned set, in order, the count being the item's set count. A union on `trackingType`, and
 * every set carries the same tag as its own `type`, as a workout's entries do: an item never holds
 * a set it cannot plan.
 */
const RoutineItemSchema = Schema.Union(
  Schema.Struct({
    trackingType: Schema.Literal('weightReps'),
    ...itemFields,
    sets: Schema.Array(WeightRepsRoutineSetSchema),
  }),
  Schema.Struct({
    trackingType: Schema.Literal('repsOnly'),
    ...itemFields,
    sets: Schema.Array(RepsOnlyRoutineSetSchema),
  }),
  Schema.Struct({
    trackingType: Schema.Literal('duration'),
    ...itemFields,
    sets: Schema.Array(DurationRoutineSetSchema),
  }),
);

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

export type WeightRepsRoutineSet = typeof WeightRepsRoutineSetSchema.Type;

export type RepsOnlyRoutineSet = typeof RepsOnlyRoutineSetSchema.Type;

export type DurationRoutineSet = typeof DurationRoutineSetSchema.Type;

/** One planned set, tagged with what it records. */
export type RoutineSet = WeightRepsRoutineSet | RepsOnlyRoutineSet | DurationRoutineSet;

/**
 * What an item's sets record. The same literals as the exercises' `TrackingType`, which a domain
 * file may not import: the callers hand one to the other, so the compiler keeps the lists equal.
 */
export type TrackingType = RoutineItem['trackingType'];

/** An item with no tracking type or sets: what every type's item shares. */
export type ItemFields = Omit<RoutineItem, 'trackingType' | 'sets'>;
