import { Schema } from 'effect';

/**
 * What a catalog search asks for: a term matched against the name in either language, and at
 * most one category, piece of equipment and primary muscle. `null` leaves a taxonomy unfiltered.
 */
const ExerciseFilterSchema = Schema.Struct({
  query: Schema.String,
  categoryId: Schema.NullOr(Schema.Number),
  equipmentId: Schema.NullOr(Schema.Number),
  muscleId: Schema.NullOr(Schema.Number),
});

export type ExerciseFilter = typeof ExerciseFilterSchema.Type;
