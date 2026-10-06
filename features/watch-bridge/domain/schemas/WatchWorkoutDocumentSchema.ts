import { Schema } from 'effect';
import { IMPORT_LIMITS, ITEM_BOUNDS } from '@/features/watch-bridge/domain/entities/WatchBounds';
import { WATCH_WORKOUT_FORMAT, WATCH_WORKOUT_VERSIONS } from '@/features/watch-bridge/domain/entities/WatchFormat';

/** The longest title or exercise name a watch workout may carry. */
const MAX_TITLE = 200;
/** No set a person logs is longer than this; a longer "workout" is a clock gone wrong. */
const MAX_DURATION_SECONDS = 24 * 60 * 60;
/** A logged set may have no reps, unlike a planned one. */
const REPS = { min: 0, max: ITEM_BOUNDS.reps.max };
/** A logged timed set may have no time, unlike a planned one. */
const SET_SECONDS = { min: 0, max: ITEM_BOUNDS.durationSeconds.max };

const within = (range: { readonly min: number; readonly max: number }) =>
  Schema.Number.pipe(Schema.finite(), Schema.between(range.min, range.max));
const wholeWithin = (range: { readonly min: number; readonly max: number }) => within(range).pipe(Schema.int());

/** Absent or `null` both read as `null`. */
const nullable = <A, I>(schema: Schema.Schema<A, I>) =>
  Schema.optionalWith(Schema.NullOr(schema), { default: () => null });

const NullableText = (max: number) => nullable(Schema.String.pipe(Schema.maxLength(max)));

/** An ISO 8601 moment that `Date.parse` can read. */
const Moment = Schema.String.pipe(Schema.filter(text => Number.isFinite(Date.parse(text))));

const index = wholeWithin({ min: 0, max: ITEM_BOUNDS.sets.max });
const completed = Schema.Boolean;
const rpe = nullable(within(ITEM_BOUNDS.rpe));

const WatchWeightRepsSet = Schema.Struct({
  type: Schema.Literal('weightReps'),
  index,
  reps: wholeWithin(REPS),
  weightKg: within(ITEM_BOUNDS.weightKg),
  completed,
  rpe,
});

const WatchRepsOnlySet = Schema.Struct({
  type: Schema.Literal('repsOnly'),
  index,
  reps: wholeWithin(REPS),
  completed,
  rpe,
});

const WatchDurationSet = Schema.Struct({
  type: Schema.Literal('duration'),
  index,
  durationSeconds: wholeWithin(SET_SECONDS),
  completed,
  rpe,
});

const setList = <A, I>(set: Schema.Schema<A, I>) =>
  Schema.Array(set).pipe(Schema.minItems(1), Schema.maxItems(ITEM_BOUNDS.sets.max));

const entryFields = {
  exerciseId: Schema.String.pipe(Schema.minLength(1)),
  exerciseName: Schema.String.pipe(Schema.maxLength(MAX_TITLE)),
  restSeconds: wholeWithin(ITEM_BOUNDS.restSeconds),
  notes: NullableText(ITEM_BOUNDS.notesLength),
};

/** An entry of one tracking type: every set carries the same tag as its own `type`. */
const WatchWorkoutEntry = Schema.Union(
  Schema.Struct({ ...entryFields, trackingType: Schema.Literal('weightReps'), sets: setList(WatchWeightRepsSet) }),
  Schema.Struct({ ...entryFields, trackingType: Schema.Literal('repsOnly'), sets: setList(WatchRepsOnlySet) }),
  Schema.Struct({ ...entryFields, trackingType: Schema.Literal('duration'), sets: setList(WatchDurationSet) }),
);

/**
 * `kinetiq.watch-workout` v3, watch to phone: one finished workout, checked against the same
 * bounds the routine editor enforces. It is the phone's `CompletedWorkout` minus everything the
 * phone computes (duration, volume, set count, estimated 1RM, records). Each entry carries its
 * `trackingType` and each set the same tag as its `type`.
 */
export const WatchWorkoutDocumentSchema = Schema.Struct({
  format: Schema.Literal(WATCH_WORKOUT_FORMAT),
  version: Schema.Literal(...WATCH_WORKOUT_VERSIONS),
  // NOTE: a UUID minted on the watch. The activity id is `watch-<id>`, which makes a replay a no-op.
  id: Schema.String.pipe(Schema.pattern(/^[A-Za-z0-9-]{1,80}$/)),
  routineId: nullable(Schema.String),
  title: Schema.String.pipe(Schema.maxLength(MAX_TITLE)),
  startedAt: Moment,
  endedAt: Moment,
  entries: Schema.Array(WatchWorkoutEntry).pipe(Schema.maxItems(IMPORT_LIMITS.itemsPerRoutine)),
  notes: NullableText(ITEM_BOUNDS.notesLength),
}).pipe(
  Schema.filter(document => {
    const elapsed = Date.parse(document.endedAt) - Date.parse(document.startedAt);
    return elapsed >= 0 && Math.round(elapsed / 1000) <= MAX_DURATION_SECONDS;
  }),
);

export type WatchWorkoutDocument = typeof WatchWorkoutDocumentSchema.Type;
