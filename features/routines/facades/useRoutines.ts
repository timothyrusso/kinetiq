import { useMemo } from 'react';
import { useEffectQuery } from '@/features/core/query';
import type { Routine } from '@/features/routines/domain/schemas/RoutineSchema';
import { routineQueryKeys } from '@/features/routines/facades/routineQueryKeys';
import { listRoutines } from '@/features/routines/useCases/listRoutines';

const NO_ROUTINES: readonly Routine[] = [];

/** Every routine, most recently changed first. */
export function useRoutines() {
  const query = useEffectQuery({ queryKey: routineQueryKeys.list(), queryFn: listRoutines });
  const routines = query.data ?? NO_ROUTINES;
  return useMemo(
    () => ({
      routines,
      count: routines.length,
      isEmpty: query.status === 'success' && routines.length === 0,
      isLoading: query.isLoading,
      error: query.error,
      refresh: query.refetch,
    }),
    [query.error, query.isLoading, query.refetch, query.status, routines],
  );
}
