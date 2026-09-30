import { Schema } from 'effect';
import { FORMAT_VERSION, ROUTINES_FORMAT } from '@/features/transfer/domain/entities/TransferFormat';

/** One planned set on disk, in the order the sets are performed. */
const RoutineFileSetSchema = Schema.Struct({
  reps: Schema.Number,
  weightKg: Schema.Number,
  targetRpe: Schema.NullOr(Schema.Number),
});

/**
 * One routine item on disk: only what a person would write. A stored item also has an id, a
 * position and a snapshot; an AI cannot know them, and a file that asked for them would be a file
 * nobody could author by hand. The importer mints ids, keeps the list order and looks the
 * exercise up.
 */
const RoutineFileItemSchema = Schema.Struct({
  // NOTE: `wger:<id>` from the public catalog, or a `local:` id from an export. Optional on import.
  exerciseId: Schema.String,
  exerciseName: Schema.String,
  restSeconds: Schema.Number,
  // NOTE: optional on import.
  notes: Schema.NullOr(Schema.String),
  sets: Schema.Array(RoutineFileSetSchema),
});

const RoutineFileRoutineSchema = Schema.Struct({
  name: Schema.String,
  items: Schema.Array(RoutineFileItemSchema),
});

/**
 * `kinetiq.routines` v2, as Export writes it. The field order is the file's key order. Reading
 * is lenient on purpose (an AI's answer is rarely this exact), reads v1 as well, and lives in
 * `parseRoutines`.
 */
export const RoutinesFileSchema = Schema.Struct({
  format: Schema.Literal(ROUTINES_FORMAT),
  version: Schema.Literal(FORMAT_VERSION),
  exportedAt: Schema.String,
  routines: Schema.Array(RoutineFileRoutineSchema),
});
