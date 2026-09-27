import { useEffectQuery } from '@/features/core/query';
import type { ExerciseSnapshot } from '@/features/exercises';
import { RoutineId } from '@/features/routines/domain/schemas/RoutineId';
import { routineQueryKeys } from '@/features/routines/facades/routineQueryKeys';
import { getRoutineDetail } from '@/features/routines/useCases/getRoutineDetail';

const NO_SNAPSHOTS: ReadonlyMap<string, ExerciseSnapshot> = new Map();

/** Stands in for the id while there is none; the query is disabled then, so it is never read. */
const NO_ROUTINE = RoutineId.make('none');

/**
 * Routine `id` and the stored snapshots its items name, read together so a screen never draws
 * rows without their pictures. `missing` is true once the read settled and found no routine,
 * which is neither loading nor a failure.
 */
export function useRoutine(id: RoutineId | null) {
  const query = useEffectQuery({
    queryKey: routineQueryKeys.detail(id ?? 'none'),
    queryFn: getRoutineDetail(id ?? NO_ROUTINE),
    enabled: id !== null,
  });
  return {
    routine: query.data?.routine ?? null,
    snapshots: query.data?.snapshots ?? NO_SNAPSHOTS,
    missing: query.status === 'success' && query.data === null,
    isLoading: query.isLoading,
    error: query.error,
    refresh: query.refetch,
  };
}
