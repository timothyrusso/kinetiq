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
