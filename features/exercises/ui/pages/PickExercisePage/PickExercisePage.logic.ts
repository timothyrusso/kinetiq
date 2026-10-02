import { useCallback, useMemo, useState } from 'react';
import { type TKey, useT } from '@/features/core/translations';
import { useDebouncedValue, useIsSettling } from '@/features/core/utils';
import type { ExerciseFilter } from '@/features/exercises/domain/schemas/ExerciseFilterSchema';
import type { Exercise } from '@/features/exercises/domain/schemas/ExerciseSchema';
import { useExerciseSearch } from '@/features/exercises/facades/useExerciseSearch';
import { useExerciseTaxonomy } from '@/features/exercises/facades/useExerciseTaxonomy';

/** One empty array, so the list's data keeps its identity while an error is shown. */
const NO_ROWS: readonly Exercise[] = [];

/** Where the picked exercises go, which names the list the footer counts against. */
export type PickDestination = 'routine' | 'workout';

const INCLUDED_KEY = {
  routine: 'details.pickerIncluded',
  workout: 'details.pickerIncludedInWorkout',
} as const satisfies Record<PickDestination, TKey>;

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
  readonly destination: PickDestination;
}

/**
 * The picker's search. It owns its term and taxon keys locally rather than in a shared store, so
 * building a routine never rewires another screen's filter behind the modal.
 *
 * The query key is built from the debounced filter, so typing "roman", "romanian", "romanian
 * deadlift" costs one catalog read rather than three, and no result is ever copied out of the
 * cache into local state: there is no shadow array for a late response to overwrite.
 *
 * Every row read is shown: the sheet's list is a `FlashList`, so a longer read costs no more
 * rendering. An explicit Load more widens the read by one catalog page and gives it a visible
 * state, which `onEndReached` cannot at the end of a short list.
 */
export function usePickExercisePageLogic({ onPick, isIncluded, destination }: PickExercisePageProps) {
  const { t } = useT();
  const [query, setQuery] = useState('');
  const [muscleId, setMuscleId] = useState<string | null>(null);
  const [equipmentId, setEquipmentId] = useState<string | null>(null);
  const debounced = useDebouncedValue(query);
  const settling = useIsSettling(query, debounced);

  const filter = useMemo<ExerciseFilter>(
    () => ({ query: debounced, bodyArea: null, muscle: muscleId, equipment: equipmentId }),
    [debounced, muscleId, equipmentId],
  );
  const search = useExerciseSearch(filter);
  const taxonomy = useExerciseTaxonomy();

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
  const toggleMuscle = useCallback((id: string) => setMuscleId(current => (current === id ? null : id)), []);
  const toggleEquipment = useCallback((id: string) => setEquipmentId(current => (current === id ? null : id)), []);
  const clearFilters = useCallback(() => {
    setMuscleId(null);
    setEquipmentId(null);
  }, []);
  const retry = useCallback(() => void refresh(), [refresh]);

  return {
    state: {
      query,
      muscleId,
      equipmentId,
      settling,
      // NOTE: an error replaces the rows rather than sitting above stale ones.
      rows: search.error === null ? items : NO_ROWS,
      total: search.total,
      error: search.error,
      isLoading: search.isLoading,
      isPlaceholder,
      hasMore: search.hasMore,
      isFetchingNextPage: search.isFetchingNextPage,
      muscles: taxonomy.data?.muscles ?? [],
      equipment: taxonomy.data?.equipment ?? [],
    },
    derived: {
      searching: query.trim().length > 0,
      filtered: muscleId !== null || equipmentId !== null,
      includedCount,
      // NOTE: no count until the library has answered; a placeholder number would be read aloud.
      libraryHint: settling
        ? t('exerciseList.searching')
        : search.total === null
          ? undefined
          : t('details.pickerInLibrary', { count: search.total }),
      includedNote: includedCount > 0 ? t(INCLUDED_KEY[destination], { count: includedCount }) : null,
    },
    effects: {
      setQuery,
      select,
      toggleMuscle,
      toggleEquipment,
      clearFilters,
      loadMore: loadNextPage,
      retry,
      isIncluded,
    },
  };
}
