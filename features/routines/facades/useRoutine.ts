import { useMemo } from 'react';
import { useEffectQuery } from '@/features/core/query';
import { type ExerciseSnapshot, snapshotInLanguage, useCatalogLanguage } from '@/features/exercises';
import { RoutineId } from '@/features/routines/domain/schemas/RoutineId';
import { routineQueryKeys } from '@/features/routines/facades/routineQueryKeys';
import { getRoutineDetail } from '@/features/routines/useCases/getRoutineDetail';

const NO_SNAPSHOTS: ReadonlyMap<string, ExerciseSnapshot> = new Map();

/** Stands in for the id while there is none; the query is disabled then, so it is never read. */
const NO_ROUTINE = RoutineId.make('none');

/**
 * Routine `id` and the stored snapshots its items name, read together so a screen never draws
 * rows without their pictures. The snapshots' muscles and equipment are named in the app's
 * language, whichever one they were picked in. `missing` is true once the read settled and found no routine,
 * which is neither loading nor a failure.
 *
 * It refetches on mount once invalidated, against the app's `refetchOnMount: false`: a finished
 * workout invalidates every routine while no routine screen may be open, and the next opening
 * would otherwise show the trained count read before it. A detail nothing invalidated is not
 * read again.
 */
export function useRoutine(id: RoutineId | null) {
  const language = useCatalogLanguage();
  const query = useEffectQuery({
    queryKey: routineQueryKeys.detail(id ?? 'none'),
    queryFn: getRoutineDetail(id ?? NO_ROUTINE),
    enabled: id !== null,
    refetchOnMount: query => query.state.isInvalidated,
  });
  const stored = query.data?.snapshots;
  const snapshots = useMemo(
    () =>
      stored === undefined
        ? NO_SNAPSHOTS
        : new Map([...stored].map(([exerciseId, snapshot]) => [exerciseId, snapshotInLanguage(snapshot, language)])),
    [stored, language],
  );
  return {
    routine: query.data?.routine ?? null,
    snapshots,
    missing: query.status === 'success' && query.data === null,
    isLoading: query.isLoading,
    error: query.error,
    refresh: query.refetch,
  };
}
