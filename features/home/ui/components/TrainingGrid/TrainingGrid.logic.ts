import { useMemo } from 'react';
import type { TKey, TVars } from '@/features/core/translations';
import type { TrainingHeatmap } from '@/features/workouts';

/** The grid's footer and its spoken summary, phrased once per heatmap and language. */
export function useTrainingGridLogic(heatmap: TrainingHeatmap, weeks: number, t: (key: TKey, vars?: TVars) => string) {
  const labels = useMemo(() => {
    const trained = heatmap.days.filter(day => day.value > 0).length;
    const footer = t('heatmap.workouts', { count: heatmap.workouts, weeks });
    const days = t('heatmap.days', { count: trained });
    return { footer, a11y: t('heatmap.a11y', { days, weeks, workouts: footer }) };
  }, [heatmap, t, weeks]);
  return { derived: labels };
}
