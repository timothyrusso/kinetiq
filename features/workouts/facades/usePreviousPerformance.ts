import { useCallback, useMemo } from 'react';
import { useEffectQuery } from '@/features/core/query';
import type { PreviousLift } from '@/features/workouts/domain/entities/PreviousLift';
import { workoutQueryKeys } from '@/features/workouts/facades/workoutQueryKeys';
import { previousPerformance } from '@/features/workouts/useCases/previousPerformance';

const NONE: ReadonlyMap<string, PreviousLift> = new Map();

/**
 * What the user lifted last time on each exercise of routine `routineId`: what tells someone
 * whether to add weight. Keyed by the routine, so a finished workout invalidates exactly the
 * routine it trained; a workout with no routine reads nothing.
 */
export function usePreviousPerformance(routineId: string | null, exerciseIds: readonly string[]) {
  const query = useEffectQuery({
    queryKey: workoutQueryKeys.previousPerformance(routineId ?? 'none'),
    queryFn: previousPerformance(exerciseIds),
    enabled: routineId !== null,
    staleTime: 60_000,
  });
  const previous = useMemo(() => query.data ?? NONE, [query.data]);
  const get = useCallback((exerciseId: string) => previous.get(exerciseId), [previous]);
  return { get, previous, isLoading: query.isLoading, error: query.error };
}
