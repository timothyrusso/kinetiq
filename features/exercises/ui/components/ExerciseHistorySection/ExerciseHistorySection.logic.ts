import { router } from 'expo-router';
import { useCallback, useMemo } from 'react';
import type { LinePoint, MetaItem } from '@/features/core/design-system';
import { routes } from '@/features/core/navigation';
import { useT } from '@/features/core/translations';
import { agoLabel, formatShortDateLocalized, formatWeight } from '@/features/core/utils';
import { useSettings } from '@/features/settings';
import { formatRecordValue, RECORD_LABEL, useExerciseHistory } from '@/queries/useExerciseHistory';

/** History rows shown before the list stops. */
const HISTORY_PREVIEW = 6;

/**
 * What the user has done with the exercise: when they last did it, the heaviest weight per
 * session as a line, the latest sessions and the records held.
 */
export function useExerciseHistorySectionLogic(exerciseId: string | null) {
  const { t, locale } = useT();
  const units = useSettings(settings => settings.unitSystem);
  const { history, records, isLoading } = useExerciseHistory(exerciseId);

  // NOTE: the heaviest completed set per session, in the user's units, built once per history
  // change so the chart receives stable points rather than a fresh array per render.
  const weightChart = useMemo(() => {
    const trend = history.weightTrend;
    const points: LinePoint[] = trend.map(point => ({
      key: point.activityId,
      label: formatShortDateLocalized(point.performedAt, locale),
      value: point.weightKg,
    }));
    const first = trend[0];
    const last = trend.at(-1);
    const a11y =
      first && last
        ? t('exerciseDetail.weightChartA11y', {
            count: trend.length,
            first: formatWeight(first.weightKg, units),
            last: formatWeight(last.weightKg, units),
          })
        : '';
    return { points, a11y };
  }, [history.weightTrend, locale, t, units]);

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
  const formatChartWeight = useCallback((kg: number) => formatWeight(kg, units), [units]);
  const openSession = useCallback((activityId: string) => {
    router.push(routes.activityDetail(activityId));
  }, []);

  return {
    state: { isLoading, units, sessions, logged: history.sessionsCount > 0 },
    derived: {
      lastPerformed,
      // NOTE: two points is the least that makes a line; one session is a dot, and the set above
      // already says what it was.
      showChart: weightChart.points.length >= 2,
      chartPoints: weightChart.points,
      chartA11y: weightChart.a11y,
      recordRows,
    },
    effects: { formatChartWeight, openSession },
  };
}
