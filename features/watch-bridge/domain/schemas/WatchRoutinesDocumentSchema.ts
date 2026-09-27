import { Schema } from 'effect';
import { IMPORT_LIMITS, ITEM_BOUNDS } from '@/features/watch-bridge/domain/entities/WatchBounds';
import { WATCH_FORMAT_VERSION, WATCH_ROUTINES_FORMAT } from '@/features/watch-bridge/domain/entities/WatchFormat';

const within = (range: { readonly min: number; readonly max: number }) =>
  Schema.Number.pipe(Schema.finite(), Schema.between(range.min, range.max));

const WatchRoutineItem = Schema.Struct({
  id: Schema.String,
  exerciseId: Schema.String,
  exerciseName: Schema.String,
  sets: within(ITEM_BOUNDS.sets).pipe(Schema.int()),
  // NOTE: a number or a range, as on the phone ("8", "8-12"); the watch reads it with `repsFromRange`.
  reps: Schema.String.pipe(Schema.maxLength(ITEM_BOUNDS.repsLength)),
  weightKg: within(ITEM_BOUNDS.weightKg),
  restSeconds: within(ITEM_BOUNDS.restSeconds).pipe(Schema.int()),
  notes: Schema.NullOr(Schema.String.pipe(Schema.maxLength(ITEM_BOUNDS.notesLength))),
});

const WatchRoutine = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
  items: Schema.Array(WatchRoutineItem).pipe(Schema.maxItems(IMPORT_LIMITS.itemsPerRoutine)),
});

/**
 * `kinetiq.watch-routines` v1, phone to watch: every routine, and the unit the watch shows
 * weights in. The watch rejects a snapshot outside these bounds. The field order is the order on
 * the wire.
 */
export const WatchRoutinesDocumentSchema = Schema.Struct({
  format: Schema.Literal(WATCH_ROUTINES_FORMAT),
  version: Schema.Literal(WATCH_FORMAT_VERSION),
  exportedAt: Schema.String,
  unitSystem: Schema.Literal('metric', 'imperial'),
  routines: Schema.Array(WatchRoutine).pipe(Schema.maxItems(IMPORT_LIMITS.routines)),
});

export type WatchRoutinesDocument = typeof WatchRoutinesDocumentSchema.Type;
