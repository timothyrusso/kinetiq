import { Schema } from 'effect';
import { ExerciseId } from '@/features/exercises/domain/schemas/ExerciseId';

const CATALOG_ID_PREFIX = 'ex:';
const LOCAL_ID_PREFIX = 'local:';

/**
 * Whether `id` names a catalog exercise. A custom exercise lives in its own namespace and must
 * never take this prefix: a dataset edit would then collide with it.
 */
export const isCatalogExerciseId: (id: string) => id is ExerciseId = Schema.is(ExerciseId);

export function isLocalExerciseId(id: string): boolean {
  return id.startsWith(LOCAL_ID_PREFIX);
}

/**
 * A title for an id the app has no row for yet. The detail header renders before the exercise
 * is read, and the bar cannot wait for it without flashing empty, so a catalog or `local:` id
 * becomes its slug in words, `ex:barbell-squat` reading "Barbell Squat" (the catalog's own
 * fallback name, so the two agree). A header title only: never the exercise's name once its row
 * is read.
 */
export function provisionalExerciseName(id: string): string {
  const prefix = [CATALOG_ID_PREFIX, LOCAL_ID_PREFIX].find(candidate => id.startsWith(candidate));
  if (prefix === undefined) return 'Exercise';
  const key = id.slice(prefix.length).replace(/[-_]+/g, ' ').trim();
  return key.length > 0 ? titleCase(key) : 'Exercise';
}

/** `"romanian deadlift"` to `"Romanian Deadlift"`: slugs are lowercase words. */
function titleCase(words: string): string {
  return words
    .split(' ')
    .map(word => (word[0] ?? '').toUpperCase() + word.slice(1))
    .join(' ');
}
