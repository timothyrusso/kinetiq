import { Schema } from 'effect';
import { stringList } from '@/features/exercises/data/adapters/catalogRows';
import type { ExerciseSnapshot } from '@/features/exercises/domain/schemas/ExerciseSnapshotSchema';
import { isLocalExerciseId } from '@/features/exercises/domain/utils/exerciseId';

/** A row of the `exercises` table, the stored snapshots. */
export const SnapshotRow = Schema.Struct({
  id: Schema.String,
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

/**
 * The stored instructions as steps. A copy written by this build holds a JSON list; one written
 * before holds the previous catalog's prose, which reads as one step.
 */
function steps(raw: string | null): string[] {
  const text = raw?.trim() ?? '';
  if (text.length === 0) return [];
  return text.startsWith('[') ? stringList(text) : [text];
}

/** A stored row as a snapshot. Lists never render an empty box: the thumbnail falls back to the image. */
export function snapshotFromRow(row: typeof SnapshotRow.Type): ExerciseSnapshot {
  return {
    exerciseId: row.id,
    name: row.name,
    instructions: steps(row.instructions),
    category: row.category,
    primaryMuscles: stringList(row.primary_muscles),
    secondaryMuscles: stringList(row.secondary_muscles),
    equipment: stringList(row.equipment),
    imageUrl: row.image_url,
    thumbnailUrl: row.thumbnail_url ?? row.image_url,
    capturedAt: row.captured_at,
  };
}

/**
 * The bound values of the snapshot upsert, in its column order. The list columns are JSON, and
 * `source` says whether a copy came from the catalog: a `local` exercise has nothing in the
 * catalog to show instead. `external_id` held the previous catalog's number
 * and stays null from this build on.
 */
export function snapshotToRow(snapshot: ExerciseSnapshot): (string | number | null)[] {
  return [
    snapshot.exerciseId,
    snapshot.name,
    null,
    JSON.stringify(snapshot.instructions),
    snapshot.category,
    JSON.stringify(snapshot.primaryMuscles),
    JSON.stringify(snapshot.secondaryMuscles),
    JSON.stringify(snapshot.equipment),
    snapshot.imageUrl,
    snapshot.thumbnailUrl ?? snapshot.imageUrl,
    isLocalExerciseId(snapshot.exerciseId) ? 'local' : 'remote',
    snapshot.capturedAt,
  ];
}
