import { Schema } from 'effect';
import {
  BODY_AREAS,
  FORCES,
  LEVELS,
  MECHANICS,
  TRAINING_TYPES,
} from '@/features/exercises/domain/entities/catalogTaxonomy';

/**
 * The exercise shape the app renders and stores. `id` is a catalog `ExerciseId` or, for an
 * exercise read back from a stored snapshot, a `local:` id or one the catalog no longer has.
 * `category`, the muscles and the equipment are already named in the render language; the
 * dataset's own keys (`bodyArea` and the rest) are null for an exercise read from a snapshot,
 * which does not keep them. Images are bundled asset paths (`assets/catalog/images/<slug>/0.webp`),
 * resolved to the bundled file at render time; an old snapshot may hold a URL instead.
 */
export const ExerciseSchema = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
  // NOTE: the steps, in order; empty when there are none.
  instructions: Schema.Array(Schema.String),
  // NOTE: the body area, named.
  category: Schema.NullOr(Schema.String),
  bodyArea: Schema.NullOr(Schema.Literal(...BODY_AREAS)),
  trainingType: Schema.NullOr(Schema.Literal(...TRAINING_TYPES)),
  level: Schema.NullOr(Schema.Literal(...LEVELS)),
  force: Schema.NullOr(Schema.Literal(...FORCES)),
  mechanic: Schema.NullOr(Schema.Literal(...MECHANICS)),
  primaryMuscles: Schema.Array(Schema.String),
  secondaryMuscles: Schema.Array(Schema.String),
  equipment: Schema.Array(Schema.String),
  // NOTE: the start frame.
  imageUrl: Schema.NullOr(Schema.String),
  // NOTE: the end frame.
  imageEndUrl: Schema.NullOr(Schema.String),
  // NOTE: smaller image for list rows; falls back to `imageUrl`.
  thumbnailUrl: Schema.NullOr(Schema.String),
  source: Schema.Literal('catalog', 'local'),
});

export type Exercise = typeof ExerciseSchema.Type;
