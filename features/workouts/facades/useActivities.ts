import { useQueryClient } from '@tanstack/react-query';
import { useEffectMutation, useEffectQuery } from '@/features/core/query';
import type { HistoryWeek } from '@/features/workouts/domain/entities/ActivityHistory';
import { ActivityId } from '@/features/workouts/domain/schemas/ActivityId';
import type { Activity } from '@/features/workouts/domain/schemas/ActivitySchema';
import { groupByWeek } from '@/features/workouts/domain/utils/groupByWeek';
import { invalidateActivityHistory, workoutQueryKeys } from '@/features/workouts/facades/workoutQueryKeys';
import { deleteActivity } from '@/features/workouts/useCases/deleteActivity';
import { getActivity } from '@/features/workouts/useCases/getActivity';
import { listActivities } from '@/features/workouts/useCases/listActivities';

/** Stable empties, so a screen memoising on these does not rebuild while loading. */
const EMPTY: readonly Activity[] = [];
const NO_WEEKS: readonly HistoryWeek[] = [];

/** Stands in for the id while there is none; the query is disabled then, so it is never read. */
const NO_ACTIVITY = ActivityId.make('none');

/**
 * The whole history, newest first, and grouped by week. Reads are cheap (it is local disk), so
 * this is the one list query; the grouping runs in `select`, so the cache holds the rows and the
 * weeks are rebuilt only when they change.
 */
export function useActivities() {
  const query = useEffectQuery({
    queryKey: workoutQueryKeys.activityList(),
    queryFn: listActivities,
    select: groupByWeek,
  });
  return {
    activities: query.data?.activities ?? EMPTY,
    weeks: query.data?.weeks ?? NO_WEEKS,
    isEmpty: query.status === 'success' && query.data.activities.length === 0,
    isLoading: query.isPending,
    isFetching: query.isFetching,
    error: query.error,
    refresh: query.refetch,
  };
}

/**
 * Workout `id`, read by id rather than out of the list, so a deep link does not depend on the
 * list having loaded. A workout that is gone arrives as `ActivityNotFound`.
 */
export function useActivity(id: ActivityId | null) {
  return useEffectQuery({
    queryKey: workoutQueryKeys.activity(id ?? 'none'),
    queryFn: getActivity(id ?? NO_ACTIVITY),
    enabled: id !== null,
  });
}

/** Deletes a workout; the history and progress re-read. */
export function useDeleteActivity() {
  const client = useQueryClient();
  return useEffectMutation({
    mutationFn: (id: ActivityId) => deleteActivity(id),
    onSuccess: () => invalidateActivityHistory(client),
  });
}
