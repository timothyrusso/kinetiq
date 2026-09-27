import { Schema } from 'effect';
import { IMPORT_LIMITS, ITEM_BOUNDS } from '@/features/watch-bridge/domain/entities/WatchBounds';
import { WATCH_FORMAT_VERSION, WATCH_WORKOUT_FORMAT } from '@/features/watch-bridge/domain/entities/WatchFormat';

/** The longest title or exercise name a watch workout may carry. */
const MAX_TITLE = 200;
/** No set a person logs is longer than this; a longer "workout" is a clock gone wrong. */
const MAX_DURATION_SECONDS = 24 * 60 * 60;
const REPS = { min: 0, max: 100 };
const RPE = { min: 0, max: 10 };

const within = (range: { readonly min: number; readonly max: number }) =>
  Schema.Number.pipe(Schema.finite(), Schema.between(range.min, range.max));
const wholeWithin = (range: { readonly min: number; readonly max: number }) => within(range).pipe(Schema.int());

/** Absent or `null` both read as `null`. */
const nullable = <A, I>(schema: Schema.Schema<A, I>) =>
  Schema.optionalWith(Schema.NullOr(schema), { default: () => null });

const NullableText = (max: number) => nullable(Schema.String.pipe(Schema.maxLength(max)));

/** An ISO 8601 moment that `Date.parse` can read. */
const Moment = Schema.String.pipe(Schema.filter(text => Number.isFinite(Date.parse(text))));

const WatchWorkoutSet = Schema.Struct({
  index: wholeWithin({ min: 0, max: ITEM_BOUNDS.sets.max }),
  reps: wholeWithin(REPS),
  weightKg: within(ITEM_BOUNDS.weightKg),
  completed: Schema.Boolean,
  rpe: nullable(within(RPE)),
});

const WatchWorkoutEntry = Schema.Struct({
  exerciseId: Schema.String.pipe(Schema.minLength(1)),
  exerciseName: Schema.String.pipe(Schema.maxLength(MAX_TITLE)),
  restSeconds: wholeWithin(ITEM_BOUNDS.restSeconds),
  notes: NullableText(ITEM_BOUNDS.notesLength),
  sets: Schema.Array(WatchWorkoutSet).pipe(Schema.minItems(1), Schema.maxItems(ITEM_BOUNDS.sets.max)),
});

/**
 * `kinetiq.watch-workout` v1, watch to phone: one finished workout, checked against the same
 * bounds the routine editor enforces. It is the phone's `CompletedWorkout` minus everything the
 * phone computes (duration, calories, volume, set count, estimated 1RM, records).
 */
export const WatchWorkoutDocumentSchema = Schema.Struct({
  format: Schema.Literal(WATCH_WORKOUT_FORMAT),
  version: Schema.Literal(WATCH_FORMAT_VERSION),
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
