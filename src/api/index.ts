/**
 * The single place that decides which exercise backend is live.
 *
 * Everything else: query hooks, screens, the routine picker: imports
 * `getExerciseProvider()` and depends only on the `ExerciseProvider` port. To
 * move off wger, write a new adapter and change the factory below; nothing else
 * in the app knows wger exists.
 */
import type { ExerciseProvider } from './types';
import { createWgerProvider } from './wger/provider';

export type ProviderDependencies = {
  /** BCP-47 code for the device UI language, e.g. "fr". */
  getLanguageCode: () => string | undefined;
};

let provider: ExerciseProvider | null = null;
let dependencies: ProviderDependencies | null = null;

/**
 * Called once during bootstrap, before any query runs. Keeping construction
 * lazy and explicit (rather than a module-side-effect singleton) means the
 * provider can never be built before the app knows the device language, and
 * tests can install a fake provider wholesale.
 */
export function configureExerciseProvider(next: ProviderDependencies): void {
  dependencies = next;
  provider = null;
}

export function getExerciseProvider(): ExerciseProvider {
  if (!provider) {
    if (!dependencies) {
      throw new Error(
        'Exercise provider used before configureExerciseProvider(). ' +
          'Check the bootstrap order in src/providers/BootstrapProvider.tsx.',
      );
    }
    provider = createWgerProvider({ getLanguageCode: dependencies.getLanguageCode });
  }
  return provider;
}

export type { ExerciseProvider } from './types';
export { ApiError, isApiError, isOfflineError } from './http';
