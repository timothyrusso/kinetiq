import { Schema } from 'effect';

/**
 * The exercise shape the app renders and stores. `id` is a catalog `ExerciseId` or, for an
 * exercise read back from a stored snapshot, a `local:` id; `source` and `externalId` trace a
 * row back to wger, so a saved routine survives the catalog dropping it.
 */
export const ExerciseSchema = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
  instructions: Schema.NullOr(Schema.String),
  category: Schema.NullOr(Schema.String),
  primaryMuscles: Schema.Array(Schema.String),
  secondaryMuscles: Schema.Array(Schema.String),
  equipment: Schema.Array(Schema.String),
  imageUrl: Schema.NullOr(Schema.String),
  // NOTE: smaller image for list rows; falls back to `imageUrl`.
  thumbnailUrl: Schema.NullOr(Schema.String),
  videoUrl: Schema.NullOr(Schema.String),
  source: Schema.Literal('remote', 'local'),
  // NOTE: wger's id, when the exercise came from the catalog.
  externalId: Schema.NullOr(Schema.Number),
});

export type Exercise = typeof ExerciseSchema.Type;
