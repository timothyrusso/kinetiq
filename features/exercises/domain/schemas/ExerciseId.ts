import { Schema } from 'effect';

/**
 * A catalog exercise's id: wger's numeric id in the app's namespace, `wger:<n>`. The routine and
 * session rows store it as `exercise_id`, beside the `local:` ids of exercises the catalog never
 * had, so the same string names the exercise everywhere.
 */
export const ExerciseId = Schema.String.pipe(Schema.pattern(/^wger:[1-9]\d*$/), Schema.brand('ExerciseId'));

export type ExerciseId = typeof ExerciseId.Type;
