import { Schema } from 'effect';
import { IMPORT_LIMITS, ITEM_BOUNDS } from '@/features/watch-bridge/domain/entities/WatchBounds';
import { WATCH_FORMAT_VERSION, WATCH_ROUTINES_FORMAT } from '@/features/watch-bridge/domain/entities/WatchFormat';

const within = (range: { readonly min: number; readonly max: number }) =>
  Schema.Number.pipe(Schema.finite(), Schema.between(range.min, range.max));

/** The set's starting RPE on the watch, which the rest screen adjusts once the set is done. */
const targetRpe = Schema.NullOr(within(ITEM_BOUNDS.rpe));

/** One planned loaded set: its place in the item is its place in the list. */
const WatchWeightRepsSet = Schema.Struct({
  type: Schema.Literal('weightReps'),
  reps: within(ITEM_BOUNDS.reps).pipe(Schema.int()),
  weightKg: within(ITEM_BOUNDS.weightKg),
  targetRpe,
});

/** One planned set counted in reps alone. */
const WatchRepsOnlySet = Schema.Struct({
  type: Schema.Literal('repsOnly'),
  reps: within(ITEM_BOUNDS.reps).pipe(Schema.int()),
  targetRpe,
});

/** One planned timed set, in whole seconds. */
const WatchDurationSet = Schema.Struct({
  type: Schema.Literal('duration'),
  durationSeconds: within(ITEM_BOUNDS.durationSeconds).pipe(Schema.int()),
  targetRpe,
});

/** One row per planned set, in order. */
const setList = <A, I>(set: Schema.Schema<A, I>) =>
  Schema.Array(set).pipe(Schema.minItems(ITEM_BOUNDS.sets.min), Schema.maxItems(ITEM_BOUNDS.sets.max));

const head = { id: Schema.String, exerciseId: Schema.String, exerciseName: Schema.String };

const tail = {
  // NOTE: one rest for every set of the exercise.
  restSeconds: within(ITEM_BOUNDS.restSeconds).pipe(Schema.int()),
  notes: Schema.NullOr(Schema.String.pipe(Schema.maxLength(ITEM_BOUNDS.notesLength))),
};

/** An item of one tracking type: every set carries the same tag as its own `type`. */
const WatchRoutineItem = Schema.Union(
  Schema.Struct({ ...head, trackingType: Schema.Literal('weightReps'), sets: setList(WatchWeightRepsSet), ...tail }),
  Schema.Struct({ ...head, trackingType: Schema.Literal('repsOnly'), sets: setList(WatchRepsOnlySet), ...tail }),
  Schema.Struct({ ...head, trackingType: Schema.Literal('duration'), sets: setList(WatchDurationSet), ...tail }),
);

const WatchRoutine = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
  items: Schema.Array(WatchRoutineItem).pipe(Schema.maxItems(IMPORT_LIMITS.itemsPerRoutine)),
});

/**
 * `kinetiq.watch-routines` v3, phone to watch: every routine, one row per planned set, and the
 * unit the watch shows weights in. Each item carries its `trackingType` and each set the same tag
 * as its `type`. The watch rejects a snapshot outside these bounds. The field order is the order
 * on the wire.
 */
export const WatchRoutinesDocumentSchema = Schema.Struct({
  format: Schema.Literal(WATCH_ROUTINES_FORMAT),
  version: Schema.Literal(WATCH_FORMAT_VERSION),
  exportedAt: Schema.String,
  unitSystem: Schema.Literal('metric', 'imperial'),
  routines: Schema.Array(WatchRoutine).pipe(Schema.maxItems(IMPORT_LIMITS.routines)),
});

export type WatchRoutinesDocument = typeof WatchRoutinesDocumentSchema.Type;
