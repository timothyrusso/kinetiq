import { Schema } from 'effect';

/**
 * A frozen copy of an exercise, stored alongside a routine or a session. It is what makes a
 * saved routine render after the catalog drops the exercise: nothing re-reads the catalog to show
 * a routine the user already owns. Images are stored as bundled asset paths, never as what a
 * Metro `require` returns: that is a module number, and it changes between builds.
 */
const ExerciseSnapshotSchema = Schema.Struct({
  exerciseId: Schema.String,
  name: Schema.String,
  instructions: Schema.Array(Schema.String),
  category: Schema.NullOr(Schema.String),
  primaryMuscles: Schema.Array(Schema.String),
  secondaryMuscles: Schema.Array(Schema.String),
  equipment: Schema.Array(Schema.String),
  // NOTE: the start frame, for the detail screen.
  imageUrl: Schema.NullOr(Schema.String),
  // NOTE: the small variant for list rows, which show a dozen at once.
  thumbnailUrl: Schema.NullOr(Schema.String),
  capturedAt: Schema.Number,
});

export type ExerciseSnapshot = typeof ExerciseSnapshotSchema.Type;
