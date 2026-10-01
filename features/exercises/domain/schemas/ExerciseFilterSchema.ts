import { Schema } from 'effect';

/**
 * What a catalog search asks for: a term matched against the name in either language, and at
 * most one body area, piece of equipment and primary muscle, each by its dataset key. `null`
 * leaves a taxonomy unfiltered.
 */
const ExerciseFilterSchema = Schema.Struct({
  query: Schema.String,
  bodyArea: Schema.NullOr(Schema.String),
  equipment: Schema.NullOr(Schema.String),
  muscle: Schema.NullOr(Schema.String),
});

export type ExerciseFilter = typeof ExerciseFilterSchema.Type;
