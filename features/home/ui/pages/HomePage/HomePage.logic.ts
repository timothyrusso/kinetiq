import { useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { useTabContentBottom } from '@/features/core/design-system';
import { routes } from '@/features/core/navigation';
import { useT } from '@/features/core/translations';
import { weekHeading } from '@/features/core/utils';
import type { HistoryRow } from '@/features/home/domain/entities/HistoryRow';
import { useSettings } from '@/features/settings';
import { type Activity, useActivities, useDeleteActivity, useTrainingHeatmap } from '@/features/workouts';

/** Weeks in the grid: about five months, which keeps each square big enough to read on a phone. */
const GRID_WEEKS = 20;

/**
 * Home: the training grid, then every workout, newest first, grouped by week. There is no second
 * history list anywhere in the app, so this one is not a preview with a "See all", it is all.
 *
 * Delete is a long press, confirmed. The dialog closes only on success, so a delete that fails
 * leaves the reason on screen instead of a row that looks as if the button did nothing.
 */
export function useHomePageLogic() {
  const { t, locale } = useT();
  const router = useRouter();
  const bottomSpace = useTabContentBottom();
  const units = useSettings(settings => settings.unitSystem);

  const summaryQuery = useTrainingHeatmap(GRID_WEEKS);
  const history = useActivities();
  const removeActivity = useDeleteActivity();
  const [pendingId, setPendingId] = useState<string | null>(null);

  // NOTE: headings are phrased here rather than in the query: they are in the app's language, and
  // the query layer has no language.
  const rows = useMemo(() => {
    const out: HistoryRow<Activity>[] = [];
    for (const week of history.weeks) {
      out.push({
        type: 'week',
        key: `w-${week.weekStart}`,
        label: weekHeading(week.weekStart, t, locale),
        count: week.activities.length,
        first: out.length === 0,
      });
      for (const activity of week.activities) out.push({ type: 'workout', activity });
    }
    return out;
  }, [history.weeks, locale, t]);

  const pendingDelete = useMemo(
    () => (pendingId === null ? null : (history.activities.find(activity => activity.id === pendingId) ?? null)),
    [history.activities, pendingId],
  );

  const openActivity = useCallback((id: string) => router.push(routes.activityDetail(id)), [router]);
  const openWorkoutTab = useCallback(() => router.push(routes.workoutTab()), [router]);

  const { refetch: refetchSummary } = summaryQuery;
  const { refresh: refetchHistory } = history;
  const refresh = useCallback(() => {
    void refetchHistory();
    void refetchSummary();
  }, [refetchHistory, refetchSummary]);
  const retrySummary = useCallback(() => void refetchSummary(), [refetchSummary]);

  const confirmDelete = useCallback(() => {
    if (!pendingDelete) return;
    removeActivity.mutate(pendingDelete.id, { onSuccess: () => setPendingId(null) });
  }, [pendingDelete, removeActivity]);
  const cancelDelete = useCallback(() => {
    // NOTE: a reopened dialog must not report the previous attempt's failure.
    removeActivity.reset();
    setPendingId(null);
  }, [removeActivity]);

  return {
    state: {
      rows,
      gridWeeks: GRID_WEEKS,
      units,
      locale,
      bottomSpace,
      heatmap: summaryQuery.data,
      heatmapPending: summaryQuery.isPending,
      heatmapError: summaryQuery.isError ? summaryQuery.error : null,
      historyEmpty: history.isEmpty,
      historyLoading: history.isLoading,
      historyError: history.error,
      refreshing: history.isFetching && !history.isLoading,
      pendingDelete,
      deleting: removeActivity.isPending,
    },
    derived: {
      title: t('tabs.home'),
      deleteMessage:
        pendingDelete === null
          ? ''
          : removeActivity.isError
            ? t('activity.deleteFailed')
            : t('activity.deleteMessage', { name: pendingDelete.title }),
    },
    effects: {
      openActivity,
      askDelete: setPendingId,
      openWorkoutTab,
      refresh,
      retrySummary,
      confirmDelete,
      cancelDelete,
    },
  };
}
