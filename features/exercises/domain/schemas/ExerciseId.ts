import { Schema } from 'effect';

/**
 * A catalog exercise's id: `ex:` and the dataset's slug, which never changes. The routine and
 * session rows store it as `exercise_id`, beside the `local:` ids of exercises the catalog never
 * had, so the same string names the exercise everywhere.
 */
export const ExerciseId = Schema.String.pipe(Schema.pattern(/^ex:[a-z0-9-]+$/), Schema.brand('ExerciseId'));

export type ExerciseId = typeof ExerciseId.Type;
