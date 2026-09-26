/**
 * Workout history queries.
 *
 * The whole history lives in SQLite, so "server state" here means local disk rather than a
 * network. Two consequences:
 *
 * - Reads are cheap, so there is one list query: every session, newest first. Home draws it
 *   whole, grouped by week, and the About screen counts it. Grouping happens in `select`, so
 *   the cache holds the raw rows and the grouped view is rebuilt only when they change.
 * - Writing must invalidate, not patch. Finishing a workout inserts an activity, recomputes
 *   PRs and bumps a routine's completion count in one transaction, and several cache keys
 *   become stale at once. `invalidateAfterWorkout` is the single place that says which.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { activityRepository } from '@/persistence';
import type { Activity } from '@/domain/types';
import { queryKeys } from '@/query/keys';
import { invalidateActivityHistory } from '@/query/invalidation';
import { startOfWeek } from '@/utils/format';
import { tr } from '@/i18n/tr';

type HistoryWeek = {
  /** Local Monday at midnight. */
  weekStart: number;
  activities: Activity[];
};

type ActivityHistory = {
  /** Every session, newest first. */
  activities: Activity[];
  /** The same rows in Monday-start weeks, newest week first. */
  weeks: HistoryWeek[];
};

/** Rows arrive newest first, so a new week starts wherever the Monday changes. */
function groupByWeek(items: readonly Activity[]): ActivityHistory {
  const weeks: HistoryWeek[] = [];
  for (const activity of items) {
    const weekStart = startOfWeek(activity.startedAt).getTime();
    const current = weeks.at(-1);
    if (current && current.weekStart === weekStart) current.activities.push(activity);
    else weeks.push({ weekStart, activities: [activity] });
  }
  return { activities: [...items], weeks };
}

export function useActivityHistory() {
  const query = useQuery({
    queryKey: queryKeys.activities.list(),
    queryFn: () => activityRepository.list({ order: 'desc' }),
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

/** Stable empties, so a screen memoising on these does not rebuild while loading. */
const EMPTY: Activity[] = [];
const NO_WEEKS: HistoryWeek[] = [];

/**
 * Detail is fetched by id rather than read out of the list cache, so a detail screen opened
 * from a deep link does not depend on a list having loaded first. The id-only key also means opening the same session from Home or from a deep link is one
 * entry.
 */
export function useActivity(id: string | null) {
  return useQuery({
    queryKey: queryKeys.activities.detail(id ?? 'none'),
    queryFn: async () => {
      if (!id) return null;
      const activity = await activityRepository.byId(id);
      if (!activity) throw new Error(tr('states.activityGone'));
      return activity;
    },
    enabled: id !== null,
  });
}

export function useDeleteActivity() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => activityRepository.remove(id),
    onSuccess: () => invalidateActivityHistory(client),
  });
}

