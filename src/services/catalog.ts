/**
 * The imperative catalog calls the legacy callers (bootstrap, the routine importer) still make,
 * run through the app runtime over the `exercises` use cases and stored snapshots. Goes away when
 * bootstrap and the importer move into features (#54).
 */
import { currentLanguage } from '@/features/core/translations';
import { getNetworkStatus, subscribeNetworkStatus } from '@/features/core/network';
import { getQueryClient } from '@/features/core/query';
import { runtime } from '@/features/core/runtime';
import { Effect } from 'effect';
import {
  type Exercise,
  type ExerciseSnapshot,
  ExerciseSnapshotRepository,
  getExercise,
  installBundledCatalogIfMissing,
  maybeRefreshCatalog as maybeRefresh,
  searchExercises,
} from '@/features/exercises';

/**
 * First launch only: the bundled catalog goes into SQLite, so day one works with no network.
 * After a failed migration the runtime cannot build, and the launch carries on without it.
 */
export async function installBundledCatalog(migrationFailed: boolean): Promise<void> {
  await runtime.runPromise(installBundledCatalogIfMissing).catch((error: unknown) => {
    if (!migrationFailed) throw error;
  });
}

/**
 * The automatic path: online and stale, or nothing. Never rejects: the catalog on the device is
 * what renders, a failure leaves it as it was, and the next launch tries again.
 */
export async function maybeRefreshCatalog(): Promise<void> {
  try {
    const refreshed = await runtime.runPromise(maybeRefresh(getNetworkStatus().online));
    if (!refreshed) return;
    const client = getQueryClient();
    await Promise.all([
      client.invalidateQueries({ queryKey: ['exercises'] }),
      client.invalidateQueries({ queryKey: ['catalog'] }),
    ]);
  } catch (error) {
    if (__DEV__) console.warn('[catalog] background refresh failed; the current catalog stays', error);
  }
}

/**
 * The launch trigger. The network probe may not have answered yet when the app becomes ready, and
 * its optimistic `online: true` would send a request into a dead radio; so this waits for the
 * first real answer, once, and then asks.
 */
export function scheduleCatalogRefresh(): void {
  if (getNetworkStatus().known) {
    void maybeRefreshCatalog();
    return;
  }
  const unsubscribe = subscribeNetworkStatus(() => {
    if (!getNetworkStatus().known) return;
    unsubscribe();
    void maybeRefreshCatalog();
  });
}

/** The catalog's exercise `id` in the current language, or null when it has none. */
export function catalogExercise(id: string): Promise<Exercise | null> {
  return runtime.runPromise(getExercise(id, currentLanguage())).catch(() => null);
}

/** The first page of a catalog search for `name`, in the current language, best match first. */
export async function searchCatalog(name: string): Promise<readonly Exercise[]> {
  const page = await runtime.runPromise(
    searchExercises({ query: name, categoryId: null, equipmentId: null, muscleId: null }, currentLanguage()),
  );
  return page.items;
}

/** The stored copy of exercise `id`, or null when nothing has stored it. */
export async function storedExercise(id: string): Promise<ExerciseSnapshot | null> {
  return (await runtime.runPromise(Effect.flatMap(ExerciseSnapshotRepository, repo => repo.byId(id)))) ?? null;
}

/** The most recently stored exercise named `name`, ignoring case, or null. */
export async function storedExerciseByName(name: string): Promise<ExerciseSnapshot | null> {
  return (await runtime.runPromise(Effect.flatMap(ExerciseSnapshotRepository, repo => repo.byName(name)))) ?? null;
}
