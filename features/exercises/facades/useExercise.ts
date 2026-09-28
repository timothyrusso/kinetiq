import { useCallback, useMemo } from 'react';
import { useEffectQuery } from '@/features/core/query';
import type { ExerciseSourceKind } from '@/features/exercises/domain/entities/ExerciseSourceKind';
import { exerciseFromSnapshot } from '@/features/exercises/domain/utils/exerciseFromSnapshot';
import { externalIdOf, isLocalExerciseId } from '@/features/exercises/domain/utils/exerciseId';
import { EXERCISE_GC_MS, exerciseQueryKeys } from '@/features/exercises/facades/exerciseQueryKeys';
import { useCatalogLanguage } from '@/features/exercises/facades/useCatalogLanguage';
import { snapshotInLanguage } from '@/features/exercises/mappers/snapshotInLanguage';
import { getExercise } from '@/features/exercises/useCases/getExercise';
import { getStoredExercise } from '@/features/exercises/useCases/getStoredExercise';

/**
 * What the app knows about exercise `id`.
 *
 * Two sources, and the screen says which one it used. The catalog row is the complete answer,
 * including the video only the catalog carries. A stored snapshot exists for everything the user
 * ever added to a routine or trained, and stands in when the catalog has no row: an exercise wger
 * has since retired, or a `local:` exercise that never came from the catalog. Precedence is
 * catalog, then snapshot, and `from` names whichever is on screen.
 */
export function useExercise(id: string | null) {
  const language = useCatalogLanguage();
  const fetchable = id !== null && !isLocalExerciseId(id) && externalIdOf(id) !== null;

  // NOTE: no `staleTime`: a single indexed row, and being wrong about an exercise the user added to
  // a routine two seconds ago costs more than re-reading it on every open.
  const stored = useEffectQuery({
    queryKey: exerciseQueryKeys.stored(id ?? 'none'),
    queryFn: getStoredExercise(id ?? ''),
    enabled: id !== null,
  });

  const catalog = useEffectQuery({
    queryKey: exerciseQueryKeys.detail(id ?? 'none', language),
    queryFn: getExercise(id ?? '', language),
    enabled: fetchable,
    staleTime: Infinity,
    gcTime: EXERCISE_GC_MS,
  });

  const snapshot = useMemo(
    () => (stored.data == null ? null : snapshotInLanguage(stored.data, language)),
    [stored.data, language],
  );
  const fromCatalog = catalog.data ?? null;
  const exercise = fromCatalog ?? (snapshot === null ? null : exerciseFromSnapshot(snapshot));
  const from: ExerciseSourceKind = fromCatalog !== null ? 'catalog' : snapshot !== null ? 'stored' : 'none';

  const { refetch: refetchStored } = stored;
  const { refetch: refetchCatalog } = catalog;
  const retry = useCallback(() => {
    void refetchStored();
    if (fetchable) void refetchCatalog();
  }, [fetchable, refetchCatalog, refetchStored]);

  return {
    // NOTE: the best row there is; null means nothing is known about this id.
    exercise,
    from,
    // NOTE: whether this id can be in the catalog at all: false for `local:` ids.
    fetchable,
    // NOTE: `id !== null` first: with no id both queries are disabled, and a disabled query with no
    // data stays pending forever, which held the screen on its skeleton for good.
    // NOTE: true only while there is nothing to show; with content up, read `isFetching`.
    isLoading:
      id !== null && exercise === null && (stored.isPending || stored.isFetching || (fetchable && catalog.isPending)),
    isFetching: catalog.isFetching,
    error: exercise === null ? (catalog.error ?? stored.error) : null,
    // NOTE: the stored row, so the screen can date its own copy.
    stored: snapshot,
    retry,
  };
}
