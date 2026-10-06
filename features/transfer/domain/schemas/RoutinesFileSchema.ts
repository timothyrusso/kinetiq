import { Schema } from 'effect';
import { FORMAT_VERSION, ROUTINES_FORMAT } from '@/features/transfer/domain/entities/TransferFormat';

/** One planned loaded set on disk: reps at a weight in kilograms, 0 being bodyweight. */
const WeightRepsFileSetSchema = Schema.Struct({
  type: Schema.Literal('weightReps'),
  reps: Schema.Number,
  weightKg: Schema.Number,
  targetRpe: Schema.NullOr(Schema.Number),
});

/** One planned set counted in reps alone. */
const RepsOnlyFileSetSchema = Schema.Struct({
  type: Schema.Literal('repsOnly'),
  reps: Schema.Number,
  targetRpe: Schema.NullOr(Schema.Number),
});

/** One planned timed set. */
const DurationFileSetSchema = Schema.Struct({
  type: Schema.Literal('duration'),
  durationSeconds: Schema.Number,
  targetRpe: Schema.NullOr(Schema.Number),
});

/**
 * What every item on disk carries besides its tracking type and its sets: only what a person
 * would write. A stored item also has an id, a position and a snapshot; an AI cannot know them,
 * and a file that asked for them would be a file nobody could author by hand. The importer mints
 * ids, keeps the list order and looks the exercise up.
 */
const itemFields = {
  // NOTE: `ex:<slug>` from the bundled catalog, or a `local:` id from an export. Optional on import.
  exerciseId: Schema.String,
  exerciseName: Schema.String,
};

const itemTail = {
  restSeconds: Schema.Number,
  // NOTE: optional on import.
  notes: Schema.NullOr(Schema.String),
};

/**
 * One routine item on disk, in the order the sets are performed. A union on `trackingType`, and
 * every set repeats it as its own `type`, so a set row read alone (pasted, or quoted by an AI)
 * still says what it records.
 */
const RoutineFileItemSchema = Schema.Union(
  Schema.Struct({
    ...itemFields,
    trackingType: Schema.Literal('weightReps'),
    ...itemTail,
    sets: Schema.Array(WeightRepsFileSetSchema),
  }),
  Schema.Struct({
    ...itemFields,
    trackingType: Schema.Literal('repsOnly'),
    ...itemTail,
    sets: Schema.Array(RepsOnlyFileSetSchema),
  }),
  Schema.Struct({
    ...itemFields,
    trackingType: Schema.Literal('duration'),
    ...itemTail,
    sets: Schema.Array(DurationFileSetSchema),
  }),
);

const RoutineFileRoutineSchema = Schema.Struct({
  name: Schema.String,
  items: Schema.Array(RoutineFileItemSchema),
});

/**
 * `kinetiq.routines` v3, as Export writes it. The field order is the file's key order. Reading
 * is lenient on purpose (an AI's answer is rarely this exact), refuses a file from before v3 by
 * its shape, and lives in `parseRoutines`.
 */
export const RoutinesFileSchema = Schema.Struct({
  format: Schema.Literal(ROUTINES_FORMAT),
  version: Schema.Literal(FORMAT_VERSION),
  exportedAt: Schema.String,
  routines: Schema.Array(RoutineFileRoutineSchema),
});
