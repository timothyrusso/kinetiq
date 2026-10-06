import { router } from 'expo-router';
import { useCallback, useMemo } from 'react';
import type { LinePoint, MetaItem } from '@/features/core/design-system';
import { routes } from '@/features/core/navigation';
import { type TKey, useT } from '@/features/core/translations';
import { agoLabel, formatShortDateLocalized, formatTimer, formatWeight, type UnitSystem } from '@/features/core/utils';
import { useSettings } from '@/features/settings';
import type { ExerciseHistory } from '@/features/workouts/domain/entities/ExerciseHistory';
import type { TrackingType } from '@/features/workouts/domain/schemas/StrengthEntrySchema';
import { useExerciseHistory } from '@/features/workouts/facades/useExerciseHistory';
import { formatRecordValue, RECORD_LABEL } from '@/features/workouts/mappers/recordLabels';

/** History rows shown before the list stops. */
const HISTORY_PREVIEW = 6;

/** Each type's chart: its title and how it is spoken, as catalog KEYS. */
const CHART_KEYS: Record<TrackingType, { readonly title: TKey; readonly a11y: TKey }> = {
  weightReps: { title: 'exerciseDetail.heaviestWeight', a11y: 'exerciseDetail.weightChartA11y' },
  repsOnly: { title: 'tracking.mostRepsChart', a11y: 'tracking.repsChartA11y' },
  duration: { title: 'tracking.longestSetChart', a11y: 'tracking.durationChartA11y' },
};

/** One point per workout of `type`, oldest first, in that type's own value. */
function trendOf(history: ExerciseHistory, type: TrackingType) {
  switch (type) {
    case 'weightReps':
      return history.weightTrend.map(point => ({ ...point, value: point.weightKg }));
    case 'repsOnly':
      return history.repsTrend.map(point => ({ ...point, value: point.reps }));
    case 'duration':
      return history.durationTrend.map(point => ({ ...point, value: point.durationSeconds }));
  }
}

/** A chart value in its type's unit: weight in the user's unit, a count of reps, or `m:ss`. */
function chartValue(type: TrackingType, value: number, units: UnitSystem): string {
  switch (type) {
    case 'weightReps':
      return formatWeight(value, units);
    case 'repsOnly':
      return String(Math.round(value));
    case 'duration':
      return formatTimer(value);
  }
}

/**
 * What the user has done with the exercise: when they last did it, a line over its sessions, the
 * latest sessions and the records held. The line charts what the latest session recorded: the
 * heaviest weight for a loaded exercise, the most reps for a reps-only one, the longest set for
 * a timed one. Sessions tracked as another type are left off it rather than drawn in another unit.
 */
export function useExerciseHistorySectionLogic(exerciseId: string | null) {
  const { t, locale } = useT();
  const units = useSettings(settings => settings.unitSystem);
  const { history, records, isLoading } = useExerciseHistory(exerciseId);
  const chartType: TrackingType = history.sessions[0]?.trackingType ?? 'weightReps';

  // NOTE: the chart's points, built once per history change so the chart receives stable points
  // rather than a fresh array per render.
  const chart = useMemo(() => {
    const trend = trendOf(history, chartType);
    const points: LinePoint[] = trend.map(point => ({
      key: point.activityId,
      label: formatShortDateLocalized(point.performedAt, locale),
      value: point.value,
    }));
    const first = trend[0];
    const last = trend.at(-1);
    const keys = CHART_KEYS[chartType];
    const a11y =
      first && last
        ? t(keys.a11y, {
            count: trend.length,
            first: chartValue(chartType, first.value, units),
            last: chartValue(chartType, last.value, units),
          })
        : '';
    return { points, a11y, title: t(keys.title) };
  }, [chartType, history, locale, t, units]);

  const lastPerformed = useMemo<MetaItem[] | null>(
    () =>
      history.lastPerformedAt === null
        ? null
        : [{ icon: 'calendar', label: t('details.lastPerformedAgo', { ago: agoLabel(history.lastPerformedAt) }) }],
    [history.lastPerformedAt, t],
  );

  const recordRows = useMemo(
    () =>
      records.map(record => ({
        kind: record.kind,
        label: t(RECORD_LABEL[record.kind]),
        value: formatRecordValue(record.kind, record.value, units),
      })),
    [records, t, units],
  );

  const sessions = useMemo(() => history.sessions.slice(0, HISTORY_PREVIEW), [history.sessions]);
  const formatChartValue = useCallback((value: number) => chartValue(chartType, value, units), [chartType, units]);
  const openSession = useCallback((activityId: string) => {
    router.push(routes.activityDetail(activityId));
  }, []);

  return {
    state: { isLoading, units, sessions, logged: history.sessionsCount > 0 },
    derived: {
      lastPerformed,
      // NOTE: two points is the least that makes a line; one session is a dot, and the set above
      // already says what it was.
      showChart: chart.points.length >= 2,
      chartTitle: chart.title,
      chartPoints: chart.points,
      chartA11y: chart.a11y,
      recordRows,
    },
    effects: { formatChartValue, openSession },
  };
}
