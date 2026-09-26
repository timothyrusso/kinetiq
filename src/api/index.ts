/**
 * The single place that decides which exercise backend is live.
 *
 * Everything else: query hooks, screens, the routine picker: imports
 * `getExerciseProvider()` and depends only on the `ExerciseProvider` port. The live
 * provider is the local catalog in SQLite (`src/api/local/provider.ts`); wger is only
 * where that catalog is downloaded from, never a runtime dependency of a screen.
 */
import type { ExerciseProvider } from './types';

let provider: ExerciseProvider | null = null;

/**
 * Called once during bootstrap, before any query runs. Explicit rather than a
 * module-side-effect singleton, so the provider cannot be used before the database
 * it reads is open, and a test can install a fake provider wholesale.
 */
export function configureExerciseProvider(next: ExerciseProvider): void {
  provider = next;
}

export function getExerciseProvider(): ExerciseProvider {
  if (!provider) {
    throw new Error(
      'Exercise provider used before configureExerciseProvider(). ' +
        'Check the bootstrap order in src/providers/bootstrap.tsx.',
    );
  }
  return provider;
}

export type { ExerciseProvider } from './types';
export { ApiError, isApiError, isOfflineError } from './http';
