import { useCallback, useEffect, useMemo, useState } from 'react';
import { useDebouncedValue, useIsSettling } from '@/features/core/utils';
import type { ExerciseFilter } from '@/features/exercises/domain/schemas/ExerciseFilterSchema';
import type { Exercise } from '@/features/exercises/domain/schemas/ExerciseSchema';
import { useExerciseSearch } from '@/features/exercises/facades/useExerciseSearch';
import { useExerciseTaxonomy } from '@/features/exercises/facades/useExerciseTaxonomy';

/**
 * Rows the sheet renders before asking for more. Plain rows inside the sheet's own `ScrollView`
 * rather than a virtualised list: a `FlashList` inside a scrolling sheet means two scroll
 * containers fighting over one gesture, a real class of bug on Android especially. An explicit
 * Load more gives the next page a visible state, which `onEndReached` cannot when the list is
 * this short.
 */
const PAGE_ROWS = 24;

export interface PickExercisePageProps {
  /** Called once per chosen exercise, with the catalog's row. */
  readonly onPick: (exercise: Exercise) => void;
  /**
   * Whether this exercise is already in the destination list. Included rows stay visible,
   * checked and disabled, rather than disappearing: a result set that silently loses rows while
   * you type reads as a broken search.
   */
  readonly isIncluded: (exerciseId: string) => boolean;
  /** Why the last pick did not land, shown above the results. */
  readonly error: string | null;
}

/**
 * The picker's search. It owns its term and taxon ids locally rather than in a shared store, so
 * building a routine never rewires another screen's filter behind the modal.
 *
 * The query key is built from the debounced filter, so typing "roman", "romanian", "romanian
 * deadlift" costs one catalog read rather than three, and no result is ever copied out of the
 * cache into local state: there is no shadow array for a late response to overwrite.
 */
export function usePickExercisePageLogic({ onPick, isIncluded }: PickExercisePageProps) {
  const [query, setQuery] = useState('');
  const [muscleId, setMuscleId] = useState<number | null>(null);
  const [equipmentId, setEquipmentId] = useState<number | null>(null);
  const [shown, setShown] = useState(PAGE_ROWS);
  const debounced = useDebouncedValue(query);
  const settling = useIsSettling(query, debounced);

  const filter = useMemo<ExerciseFilter>(
    () => ({ query: debounced, categoryId: null, muscleId, equipmentId }),
    [debounced, muscleId, equipmentId],
  );
  const search = useExerciseSearch(filter);
  const taxonomy = useExerciseTaxonomy();

  // NOTE: a new filter resets the visible window, or a Load more from a previous search would
  // carry its size over onto an unrelated result set.
  useEffect(() => {
    setShown(PAGE_ROWS);
  }, [debounced, muscleId, equipmentId]);

  const rows = useMemo(() => search.items.slice(0, shown), [search.items, shown]);
  const includedCount = useMemo(
    () => search.items.filter(exercise => isIncluded(exercise.id)).length,
    [isIncluded, search.items],
  );

  const { items, isPlaceholder, loadNextPage, refresh } = search;
  const select = useCallback(
    (exerciseId: string) => {
      if (isPlaceholder) return;
      const exercise = items.find(item => item.id === exerciseId);
      if (exercise !== undefined) onPick(exercise);
    },
    [isPlaceholder, items, onPick],
  );
  const toggleMuscle = useCallback((id: number) => setMuscleId(current => (current === id ? null : id)), []);
  const toggleEquipment = useCallback((id: number) => setEquipmentId(current => (current === id ? null : id)), []);
  const clearFilters = useCallback(() => {
    setMuscleId(null);
    setEquipmentId(null);
  }, []);
  // NOTE: the window widens by one sheet page per press, so the sheet keeps rendering plain rows
  // instead of growing a virtualiser; the facade reads its next page only once the rows it holds
  // run out. Its pages are larger than the sheet's, so rows already read can still be hidden.
  const loadMore = useCallback(() => {
    if (shown + PAGE_ROWS > items.length) loadNextPage();
    setShown(count => count + PAGE_ROWS);
  }, [items.length, loadNextPage, shown]);
  const retry = useCallback(() => void refresh(), [refresh]);

  return {
    state: {
      query,
      muscleId,
      equipmentId,
      settling,
      rows,
      total: search.total,
      error: search.error,
      isLoading: search.isLoading,
      isPlaceholder,
      hasMore: shown < search.items.length || search.hasMore,
      isFetchingNextPage: search.isFetchingNextPage,
      muscles: taxonomy.data?.muscles ?? [],
      equipment: taxonomy.data?.equipment ?? [],
    },
    derived: {
      searching: query.trim().length > 0,
      filtered: muscleId !== null || equipmentId !== null,
      includedCount,
    },
    effects: { setQuery, select, toggleMuscle, toggleEquipment, clearFilters, loadMore, retry, isIncluded },
  };
}
