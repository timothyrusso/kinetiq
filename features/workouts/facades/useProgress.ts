import { useEffectQuery } from '@/features/core/query';
import { workoutQueryKeys } from '@/features/workouts/facades/workoutQueryKeys';
import { trainingGrid, trainingSummary } from '@/features/workouts/useCases/progressStats';

/**
 * How long a computed summary stays fresh. A local recompute over a few hundred rows is cheap,
 * but a number that visibly ticks on every tab switch is not; a finished workout invalidates.
 */
const PROGRESS_STALE_TIME_MS = 60_000;

/**
 * The weekly summary of the last `rangeWeeks` weeks. Keyed by the count of weeks rather than a
 * date range, so the slot survives midnight and is refreshed by `staleTime`.
 */
export function useTrainingSummary(rangeWeeks: number) {
  return useEffectQuery({
    queryKey: workoutQueryKeys.summary(rangeWeeks),
    queryFn: trainingSummary(rangeWeeks),
    staleTime: PROGRESS_STALE_TIME_MS,
  });
}

/** Minutes trained per day, the last `weeks` weeks ending with this one, for the training grid. */
export function useTrainingHeatmap(weeks: number) {
  return useEffectQuery({
    queryKey: workoutQueryKeys.heatmap(weeks),
    queryFn: trainingGrid(weeks),
    staleTime: PROGRESS_STALE_TIME_MS,
  });
}
