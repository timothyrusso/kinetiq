import type { QueryClient } from '@tanstack/react-query';

/**
 * The workouts' query keys. Every input of a query is in its key, and the prefixes mean something:
 * one call invalidates a whole family. The exercise history sits under `exercises`, so a catalog
 * refresh reaches it too.
 */
export const workoutQueryKeys = {
  activities: ['activities'] as const,
  // NOTE: every workout, newest first: the only list, so its key has no parameters.
  activityList: () => ['activities', 'list'] as const,
  activity: (id: string) => ['activities', 'detail', id] as const,
  progress: ['progress'] as const,
  // NOTE: keyed by the window in weeks; its start is derived from the clock inside the query.
  summary: (rangeWeeks: number) => ['progress', 'summary', { rangeWeeks }] as const,
  heatmap: (weeks: number) => ['progress', 'heatmap', { weeks }] as const,
  session: ['session'] as const,
  previousPerformance: (routineId: string) => ['session', 'previous', routineId] as const,
  exerciseHistory: (exerciseId: string) => ['exercises', 'history', exerciseId] as const,
  exerciseRecords: (exerciseId: string) => ['exercises', 'records', exerciseId] as const,
};

/**
 * The routines' own prefix: a recorded workout changes its routine's trained count and date. The
 * routines own their keys; this is the one prefix they document for that.
 */
const ROUTINES_PREFIX = ['routines'] as const;

/** After a workout was deleted or recorded: the history and every progress read re-read. */
export function invalidateActivityHistory(client: QueryClient): void {
  void client.invalidateQueries({ queryKey: workoutQueryKeys.activities });
  void client.invalidateQueries({ queryKey: workoutQueryKeys.progress });
}

/**
 * After a workout was recorded: history, progress, the routines' trained counts and, for its
 * routine, what was lifted last time. The exercise catalog is left alone.
 */
export function invalidateAfterWorkout(client: QueryClient, routineId: string | null): void {
  invalidateActivityHistory(client);
  void client.invalidateQueries({ queryKey: ROUTINES_PREFIX });
  if (routineId !== null) void client.invalidateQueries({ queryKey: workoutQueryKeys.previousPerformance(routineId) });
}

/**
 * After workouts arrived from the Apple Watch: the same as a finished workout, for every routine
 * at once, since the drain reports ids rather than routines. The `session` prefix reaches each
 * routine's `previousPerformance`, so the "Last time" hint of every routine re-reads.
 */
export function invalidateAfterWatchWorkouts(client: QueryClient): void {
  invalidateAfterWorkout(client, null);
  void client.invalidateQueries({ queryKey: workoutQueryKeys.session });
}
