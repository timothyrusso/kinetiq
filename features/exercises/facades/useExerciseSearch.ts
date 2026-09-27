import { keepPreviousData } from '@tanstack/react-query';
import { useCallback, useState } from 'react';
import { useEffectQuery } from '@/features/core/query';
import type { ExerciseFilter } from '@/features/exercises/domain/schemas/ExerciseFilterSchema';
import { EXERCISE_GC_MS, exerciseQueryKeys } from '@/features/exercises/facades/exerciseQueryKeys';
import { useCatalogLanguage } from '@/features/exercises/facades/useCatalogLanguage';
import { EXERCISE_PAGE_SIZE, searchExercises } from '@/features/exercises/useCases/searchExercises';

const sameFilter = (a: ExerciseFilter, b: ExerciseFilter) =>
  a.query === b.query && a.categoryId === b.categoryId && a.equipmentId === b.equipmentId && a.muscleId === b.muscleId;

/**
 * A catalog search, a page at a time.
 *
 * Every read is answered from SQLite, and the catalog changes only when a refresh swaps it and
 * invalidates `exercises`, hence `staleTime: Infinity`. Loading more widens one read (the first
 * `n` rows) rather than appending pages, so the list is always one consistent read: a catalog
 * swapped mid-scroll cannot repeat a row across pages. While a new filter is read, the previous
 * rows stay on screen and `isPlaceholder` says so, so the UI can dim instead of flashing a
 * skeleton; a new filter starts again from the first page.
 *
 * @param active whether the screen that owns the search is on screen. Every tab's screen is mounted
 * when the native tab bar is created, so a picker that is never opened must not read the catalog.
 */
export function useExerciseSearch(filter: ExerciseFilter, active = true) {
  const language = useCatalogLanguage();
  const [window, setWindow] = useState({ filter, limit: EXERCISE_PAGE_SIZE });
  const limit = sameFilter(window.filter, filter) ? window.limit : EXERCISE_PAGE_SIZE;

  const query = useEffectQuery({
    queryKey: exerciseQueryKeys.list(filter, language, limit),
    queryFn: searchExercises(filter, language, 0, limit),
    enabled: active,
    placeholderData: keepPreviousData,
    staleTime: Infinity,
    gcTime: EXERCISE_GC_MS,
  });

  const hasMore = query.data !== undefined && query.data.nextOffset !== null;
  const isFetchingNextPage = query.isPlaceholderData && limit > EXERCISE_PAGE_SIZE;

  const loadNextPage = useCallback(() => {
    if (!hasMore || isFetchingNextPage) return;
    setWindow({ filter, limit: limit + EXERCISE_PAGE_SIZE });
  }, [filter, hasMore, isFetchingNextPage, limit]);

  return {
    items: query.data?.items ?? [],
    total: query.data?.total ?? null,
    hasMore,
    loadNextPage,
    isLoading: query.isLoading,
    // NOTE: true while the previous filter's rows are still on screen.
    isPlaceholder: query.isPlaceholderData && !isFetchingNextPage,
    isFetchingNextPage,
    error: query.error,
    refresh: query.refetch,
  };
}
