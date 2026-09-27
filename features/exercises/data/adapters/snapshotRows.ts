import { Either, Schema } from 'effect';
import type { ExerciseSnapshot } from '@/features/exercises/domain/schemas/ExerciseSnapshotSchema';

/** A row of the `exercises` table, the stored snapshots. */
export const SnapshotRow = Schema.Struct({
  id: Schema.String,
  external_id: Schema.NullOr(Schema.Number),
  name: Schema.String,
  instructions: Schema.NullOr(Schema.String),
  category: Schema.NullOr(Schema.String),
  primary_muscles: Schema.String,
  secondary_muscles: Schema.String,
  equipment: Schema.String,
  image_url: Schema.NullOr(Schema.String),
  thumbnail_url: Schema.NullOr(Schema.String),
  captured_at: Schema.Number,
});

const parseNames = Schema.decodeUnknownEither(Schema.parseJson(Schema.Array(Schema.Unknown)));

/**
 * A JSON list column as its strings. A column that does not parse, or is not a list, reads as
 * empty, and a value that is not a string is dropped: one damaged row degrades to a missing field
 * rather than blanking the screen.
 */
function names(raw: string): string[] {
  const parsed = parseNames(raw);
  if (Either.isLeft(parsed)) return [];
  return parsed.right.filter((value): value is string => typeof value === 'string');
}

/** A stored row as a snapshot. Lists never render an empty box: the thumbnail falls back to the image. */
export function snapshotFromRow(row: typeof SnapshotRow.Type): ExerciseSnapshot {
  return {
    exerciseId: row.id,
    name: row.name,
    instructions: row.instructions,
    category: row.category,
    primaryMuscles: names(row.primary_muscles),
    secondaryMuscles: names(row.secondary_muscles),
    equipment: names(row.equipment),
    imageUrl: row.image_url,
    thumbnailUrl: row.thumbnail_url ?? row.image_url,
    externalId: row.external_id,
    capturedAt: row.captured_at,
  };
}
