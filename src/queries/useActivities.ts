/**
 * Activity history queries.
 *
 * The whole history lives in SQLite, so "server state" here means local disk
 * rather than a network. Two consequences:
 *
 * - Reads are cheap and synchronous-feeling, so the list query fetches the
 *   *filtered* set in one statement and does sorting and day-grouping in the
 *   `select`. Splitting those into separate queries would multiply cache entries
 *   for data we already have in memory.
 * - Writing must invalidate, not patch. Finishing a workout inserts an activity,
 *   recomputes PRs and bumps a routine's completion count in one transaction, and
 *   several cache keys become stale at once. `invalidateAfterWorkout` is the single
 *   place that says which.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useMemo } from 'react';
import { activityRepository } from '@/persistence';
import type { Activity, ActivityKind } from '@/domain/types';
import { queryKeys, type ActivityListParams, type ActivitySort } from '@/query/keys';
import { invalidateActivityHistory } from '@/query/invalidation';
import { tr } from '@/i18n/tr';

export type ActivityGroup = {
  /** Local calendar day, ms at midnight. */
  key: number;
  label: string;
  activities: Activity[];
};

export type ActivityListView = {
  groups: ActivityGroup[];
  /** Same rows, ungrouped: what a virtualised flat list wants. */
  flat: Activity[];
  totalDurationSeconds: number;
  totalVolumeKg: number;
  totalDistanceMeters: number;
};

function sortActivities(items: Activity[], sort: ActivitySort): Activity[] {
  if (sort === 'recent') return items; // the repository already returns newest-first
  const weight = (a: Activity): number => {
    switch (sort) {
      case 'duration':
        return a.durationSeconds;
      case 'distance':
        return a.cardio?.distanceMeters ?? 0;
      case 'volume':
        return a.strength?.totalVolumeKg ?? 0;
      default:
        return a.startedAt;
    }
  };
  return [...items].sort((a, b) => weight(b) - weight(a));
}

/** Local-day boundaries, so "Today" matches the user's clock, not UTC. */
function dayKey(millis: number): number {
  const d = new Date(millis);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function buildGroups(items: readonly Activity[], groupBy: ActivityListParams['groupBy']): ActivityGroup[] {
  if (groupBy === 'none') {
    return [
      {
        key: 0,
        label: '',
        activities: [...items],
      },
    ];
  }
  const bucketSize = groupBy === 'week' ? 7 : 1;
  const buckets = new Map<number, Activity[]>();
  for (const activity of items) {
    const key = bucketStart(dayKey(activity.startedAt), bucketSize);
    const bucket = buckets.get(key);
    if (bucket) bucket.push(activity);
    else buckets.set(key, [activity]);
  }
  return [...buckets.entries()]
    .sort((a, b) => b[0] - a[0])
    .map(([key, activities]) => ({ key, label: groupLabel(key, groupBy), activities }));
}

/** Rolls a day back to the Monday-start week boundary when grouping weekly. */
function bucketStart(midnightMs: number, days: number): number {
  if (days === 1) return midnightMs;
  const d = new Date(midnightMs);
  const weekday = (d.getDay() + 6) % 7; // Monday = 0
  d.setDate(d.getDate() - weekday);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function groupLabel(midnightMs: number, groupBy: ActivityListParams['groupBy']): string {
  if (groupBy === 'none') return '';
  if (groupBy === 'week') return `Week of ${new Date(midnightMs).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}`;
  const today = dayKey(Date.now());
  const diffDays = Math.round((today - midnightMs) / 86_400_000);
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  return new Date(midnightMs).toLocaleDateString(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
}

function summarise(items: readonly Activity[]): Omit<ActivityListView, 'groups' | 'flat'> {
  let duration = 0;
  let volume = 0;
  let distance = 0;
  for (const a of items) {
    duration += a.durationSeconds;
    volume += a.strength?.totalVolumeKg ?? 0;
    distance += a.cardio?.distanceMeters ?? 0;
  }
  return { totalDurationSeconds: duration, totalVolumeKg: volume, totalDistanceMeters: distance };
}

function selectList(items: Activity[], params: ActivityListParams): ActivityListView {
  const sorted = sortActivities(items, params.sort);
  return {
    groups: buildGroups(sorted, params.groupBy),
    flat: sorted,
    ...summarise(sorted),
  };
}

/**
 * The filter panel and the list must agree on one param object, so the default is
 * frozen: a fresh object literal per render would change the query key every frame.
 */
export const DEFAULT_ACTIVITY_PARAMS: ActivityListParams = Object.freeze({
  kinds: [],
  search: '',
  sort: 'recent',
  groupBy: 'day',
});

export function useActivityList(params: ActivityListParams = DEFAULT_ACTIVITY_PARAMS) {
  const normalized: ActivityListParams = useMemo(
    () => ({
      kinds: [...params.kinds].sort() as ActivityKind[],
      search: params.search,
      sort: params.sort,
      groupBy: params.groupBy,
    }),
    [params.kinds, params.search, params.sort, params.groupBy],
  );

  const query = useQuery({
    queryKey: queryKeys.activities.list(normalized),
    queryFn: () =>
      activityRepository.list({
        kinds: normalized.kinds.length > 0 ? normalized.kinds : undefined,
        search: normalized.search || undefined,
        order: 'desc',
      }),
    // `select` is where sorting and grouping happen, so the cached value stays the
    // raw rows: one fetch serves every sort and grouping the user toggles. The
    // selector's output is rebuilt only when the rows change, so its identity is
    // stable across unrelated notifications.
    select: useCallback((rows: Activity[]) => selectList(rows, normalized), [normalized]),
  });

  return {
    groups: query.data?.groups ?? [],
    flat: query.data?.flat ?? [],
    totals: {
      durationSeconds: query.data?.totalDurationSeconds ?? 0,
      volumeKg: query.data?.totalVolumeKg ?? 0,
      distanceMeters: query.data?.totalDistanceMeters ?? 0,
    },
    isEmpty: query.status === 'success' && (query.data?.flat.length ?? 0) === 0,
    isLoading: query.isLoading,
    error: query.error,
    refresh: query.refetch,
  };
}

/** Home and Progress need a small unfiltered slice; see the key comment on why it is separate. */
export function useRecentActivities(limit = 6) {
  return useQuery({
    queryKey: queryKeys.activities.recent(limit),
    queryFn: () => activityRepository.list({ order: 'desc', limit }),
  });
}

/**
 * Detail is fetched by id rather than read out of the list cache: the list uses
 * `LIST_COLUMNS` (no route points, no split rows: a 300-point route per row would
 * make scrolling a chore), and a detail screen needs the full blob. The id-only key
 * also means opening the same activity from Home, from the list or from a deep link
 * is one entry.
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

export function useUpdateActivityNotes() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, notes }: { id: string; notes: string | null }) => {
      const existing = await activityRepository.byId(id);
      if (!existing) throw new Error(tr('states.activityGone'));
      await activityRepository.update({ ...existing, notes });
    },
    onSuccess: (_result, variables) => {
      invalidateActivityHistory(client);
      void client.invalidateQueries({
        queryKey: queryKeys.activities.detail(variables.id),
      });
    },
  });
}
