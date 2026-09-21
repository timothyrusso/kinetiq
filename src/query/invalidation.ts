/**
 * Cross-feature invalidation, in one place.
 *
 * The client turns off refetch-on-mount and refetch-on-reconnect, so ordinary
 * navigation is free of requests: which means correctness across features has to
 * be *pushed*: finishing a workout has to tell the activity list and the progress
 * charts. Doing that from the screens that happen to notice would produce a
 * different, partial set of invalidations per call site; these functions are the
 * complete answer for each event.
 *
 * Refetching is left to the default `refetchType: 'active'`: an inactive query is
 * marked stale and will refetch when something actually mounts it, which is the
 * behaviour that keeps background work at zero without serving stale data.
 */
import type { QueryClient } from '@tanstack/react-query';
import { queryKeys } from './keys';

export function invalidateActivityHistory(client: QueryClient): void {
  void client.invalidateQueries({ queryKey: queryKeys.activities.all });
  void client.invalidateQueries({ queryKey: queryKeys.progress.all });
}

/**
 * Finishing a workout touches history, progress, the routine's completion count
 * and its "previous performance" readout: and nothing in the exercise cache,
 * which is remote data with its own freshness rules.
 */
export function invalidateAfterWorkout(client: QueryClient, routineId: string | null): void {
  invalidateActivityHistory(client);
  void client.invalidateQueries({ queryKey: queryKeys.routines.all });
  if (routineId) {
    void client.invalidateQueries({
      queryKey: queryKeys.session.previousPerformance(routineId),
    });
  }
}

export function invalidateRoutines(client: QueryClient): void {
  void client.invalidateQueries({ queryKey: queryKeys.routines.all });
}

/**
 * A units change alters how stored numbers are *displayed*, and several queries
 * compute aggregates (weekly volume, pace) in canonical units that some views
 * rescale at build time rather than render time. Rather than audit which of them
 * baked a converted number into cache data, invalidate everything derived: the
 * exercise cache is remote and unaffected, so it stays put.
 */
export function invalidateAfterUnitsChange(client: QueryClient): void {
  void client.invalidateQueries({ queryKey: queryKeys.activities.all });
  void client.invalidateQueries({ queryKey: queryKeys.progress.all });
  void client.invalidateQueries({ queryKey: queryKeys.session.all });
}
