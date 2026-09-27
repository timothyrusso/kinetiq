import { Schema } from 'effect';
import { ExerciseSchema } from '@/features/exercises/domain/schemas/ExerciseSchema';

/** One page of a catalog search: its rows, the filtered total, and where the next page starts. */
const ExercisePageSchema = Schema.Struct({
  items: Schema.Array(ExerciseSchema),
  total: Schema.Number,
  // NOTE: the offset of the next page, or `null` when this page reaches the total.
  nextOffset: Schema.NullOr(Schema.Number),
});

export type ExercisePage = typeof ExercisePageSchema.Type;
