/**
 * Cross-feature invalidation the legacy callers still make. The client turns off refetch on
 * mount and on reconnect, so a write has to push its staleness; the workouts own theirs
 * (`invalidateAfterWorkout`). Refetching is left to the default `refetchType: 'active'`.
 */
import type { QueryClient } from '@tanstack/react-query';
import { queryKeys } from './keys';

export function invalidateRoutines(client: QueryClient): void {
  void client.invalidateQueries({ queryKey: queryKeys.routines.all });
}
