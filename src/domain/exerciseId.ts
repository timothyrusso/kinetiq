/**
 * Exercise identity across sources.
 *
 * Exercises come from two places: the remote catalog and the local seed. Their
 * ids live in one namespace (`wger:46`, `local:bench-press`) so a routine item
 * can reference either without a second column, and so a remote exercise that
 * has been saved offline still has one stable id.
 *
 * Both prefixes are defined here because the id scheme is the app's, not the
 * backend's: the construction sites (provider, seed) and the parse sites
 * (detail routes, repositories) must not be able to drift apart.
 */

export const REMOTE_ID_PREFIX = 'wger:';
export const LOCAL_ID_PREFIX = 'local:';

export function remoteExerciseId(externalId: number): string {
  return `${REMOTE_ID_PREFIX}${externalId}`;
}

export function localExerciseId(key: string): string {
  return `${LOCAL_ID_PREFIX}${key}`;
}

/** The backend's numeric id, or null for locally-authored exercises. */
export function externalIdOf(id: string): number | null {
  if (!id.startsWith(REMOTE_ID_PREFIX)) return null;
  const parsed = Number(id.slice(REMOTE_ID_PREFIX.length));
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

export function isLocalExerciseId(id: string): boolean {
  return id.startsWith(LOCAL_ID_PREFIX);
}

/**
 * A human-readable name for an id we have no row for.
 *
 * The exercise detail screen renders its header before it knows what the exercise *is*,
 * and it has to put something in the bar: the navigation title cannot wait for a network
 * round trip without the whole screen flashing an empty bar. This is that something —
 * `wger:1234` becomes "Exercise 1234" (the same wording the wger mapper falls back to, so
 * the two agree), and a locally-authored id becomes its own key with the prefix dropped.
 *
 * It is a title for the header bar only. Nothing should mistake it for the exercise's
 * name once the row has been read.
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

/** `"romanian deadlift"` → `"Romanian Deadlift"`. Seed keys are already lowercase words. */
function titleCase(words: string): string {
  return words
    .split(' ')
    .map((word) => (word[0] ?? '').toUpperCase() + word.slice(1))
    .join(' ');
}
