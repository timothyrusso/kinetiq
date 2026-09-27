import { ExerciseId } from '@/features/exercises/domain/schemas/ExerciseId';

const REMOTE_ID_PREFIX = 'wger:';
const LOCAL_ID_PREFIX = 'local:';

/** The catalog id of wger exercise `externalId`. */
export function remoteExerciseId(externalId: number): ExerciseId {
  return ExerciseId.make(`${REMOTE_ID_PREFIX}${externalId}`);
}

/** wger's numeric id inside `id`, or `null` for a `local:` or malformed id. */
export function externalIdOf(id: string): number | null {
  if (!id.startsWith(REMOTE_ID_PREFIX)) return null;
  const parsed = Number(id.slice(REMOTE_ID_PREFIX.length));
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

export function isLocalExerciseId(id: string): boolean {
  return id.startsWith(LOCAL_ID_PREFIX);
}

/**
 * A title for an id the app has no row for yet. The detail header renders before the exercise
 * is read, and the bar cannot wait for it without flashing empty, so `wger:1234` reads
 * "Exercise 1234" (the catalog's own fallback name, so the two agree) and a `local:` id becomes
 * its key with the prefix dropped. A header title only: never the exercise's name once its row
 * is read.
 */
export function provisionalExerciseName(id: string): string {
  const externalId = externalIdOf(id);
  if (externalId !== null) return `Exercise ${externalId}`;
  if (isLocalExerciseId(id)) {
    const key = id.slice(LOCAL_ID_PREFIX.length).replace(/[-_]+/g, ' ').trim();
    return key.length > 0 ? titleCase(key) : 'Exercise';
  }
  return 'Exercise';
}

/** `"romanian deadlift"` to `"Romanian Deadlift"`: local keys are lowercase words. */
function titleCase(words: string): string {
  return words
    .split(' ')
    .map(word => (word[0] ?? '').toUpperCase() + word.slice(1))
    .join(' ');
}
