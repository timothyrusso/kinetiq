/**
 * The exercise browser's filter state, as an external store.
 *
 * ## Why not component state
 *
 * Two screens read and write one filter: a library list (search box, chips) and the filter
 * sheet over it (category / muscle / equipment). Kept in the list, that means either
 * prop-drilling through a router that passes no props, or serialising the whole filter into
 * the URL: and a URL-borne filter means every chip tap rewrites history, so the back
 * gesture walks backwards through filter changes instead of out of the screen. Back should
 * leave. A store keeps the filter outside both screens: it survives the round trip to a
 * detail screen, which is what every real fitness app does and what a user expects after
 * they have taken the trouble to set "Chest" twice.
 *
 * ## One store per list
 *
 * The Exercises tab has one store for the life of the app. A library pushed over an exercise
 * ("browse similar", a muscle tag) builds its own from route params and drops it on unmount,
 * so browsing from exercise A, then from B, and walking back leaves A's list showing A's
 * filter, and the tab keeps whatever the user set there. The filter sheet finds its list's
 * store by the key in its own params (`storeKey`), and the tab's when there is none.
 *
 * ## Why the debounce lives here
 *
 * The query key must be the thing that settles, so that TanStack Query owns the request it
 * triggers. So the store keeps two values: `draft`, which is what the text field shows and
 * updates on every keystroke, and `filter`, which is what queries key on and updates
 * 220 ms after typing stops. A chip or a sheet selection commits immediately: waiting
 * 220 ms to apply a tap reads as lag, while waiting on *typing* is the whole point.
 *
 * Splitting draft from committed also means the input can honestly report that it is ahead
 * of the results (`isSettling`) without a second piece of state to keep in step.
 */
import { useSyncExternalStore } from 'react';
import type { ExerciseFilter } from '@/domain/types';
import { emptyFilter } from '@/api/types';

const COMMIT_DELAY_MS = 220;

export type FilterState = {
  /** Exactly what the search input shows. */
  draft: string;
  /** What queries key on. Settles after the draft. */
  filter: ExerciseFilter;
};

export type ExerciseFilterStore = {
  getState: () => FilterState;
  subscribe: (listener: () => void) => () => void;
  /**
   * Text changed: update the input at once, and schedule the query change.
   *
   * The trailing-commit form (rather than leading) is deliberate. Leading-edge would fire a
   * request for the first character typed, which for a fuzzy `name__search` is the slowest
   * possible query and the least likely one the user meant to run.
   */
  setQuery: (draft: string) => void;
  setCategoryId: (categoryId: number | null) => void;
  setMuscleId: (muscleId: number | null) => void;
  setEquipmentId: (equipmentId: number | null) => void;
  /** Clears everything, including any pending commit, "Clear filters" is instant. */
  reset: () => void;
  /** Cancels a pending commit, for a store that is being dropped. */
  dispose: () => void;
};

export function createExerciseFilterStore(initial: ExerciseFilter = emptyFilter()): ExerciseFilterStore {
  let state: FilterState = { draft: initial.query, filter: initial };
  const listeners = new Set<() => void>();
  let timer: ReturnType<typeof setTimeout> | null = null;

  const emit = () => {
    for (const listener of listeners) listener();
  };
  const cancel = () => {
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
  };
  const commit = (patch: Partial<ExerciseFilter>) => {
    cancel();
    state = { draft: patch.query ?? state.draft, filter: { ...state.filter, ...patch } };
    emit();
  };

  return {
    getState: () => state,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    setQuery: (draft) => {
      state = { ...state, draft };
      emit();
      if (timer !== null) clearTimeout(timer);
      timer = setTimeout(() => {
        timer = null;
        commit({ query: draft.trim() });
      }, COMMIT_DELAY_MS);
    },
    setCategoryId: (categoryId) => commit({ categoryId }),
    setMuscleId: (muscleId) => commit({ muscleId }),
    setEquipmentId: (equipmentId) => commit({ equipmentId }),
    reset: () => {
      cancel();
      state = { draft: '', filter: emptyFilter() };
      emit();
    },
    dispose: cancel,
  };
}

/** The Exercises tab's store, for the life of the app. */
export const tabExerciseFilter = createExerciseFilterStore();

/** Pushed lists' stores, by the key their filter sheet is handed. */
const pushed = new Map<string, ExerciseFilterStore>();
let nextKey = 0;

/**
 * Makes a pushed list's store findable by its filter sheet, until the returned function runs.
 * Called from the list's effect, so a store built twice by a strict-mode render is never
 * registered twice.
 */
export function registerExerciseFilter(store: ExerciseFilterStore): { key: string; release: () => void } {
  nextKey += 1;
  const key = String(nextKey);
  pushed.set(key, store);
  return {
    key,
    release: () => {
      pushed.delete(key);
      store.dispose();
    },
  };
}

/** The store a filter sheet writes to: its list's, or the tab's when there is no key. */
export function exerciseFilterFor(key: string | undefined): ExerciseFilterStore {
  return (key === undefined ? undefined : pushed.get(key)) ?? tabExerciseFilter;
}

// The tab store's operations, by name. The tab's own screens read the store directly; these
// keep the debounce check (`scripts/debounce-check.ts`) exercising the real module.
export const setExerciseQuery = tabExerciseFilter.setQuery;
export const setExerciseMuscleId = tabExerciseFilter.setMuscleId;
export const setExerciseEquipmentId = tabExerciseFilter.setEquipmentId;
export const resetExerciseFilter = tabExerciseFilter.reset;
export const getExerciseFilterState = tabExerciseFilter.getState;

/** How many of the three taxonomy filters are doing something. */
export function activeFilterCount(filter: ExerciseFilter): number {
  return [filter.categoryId, filter.muscleId, filter.equipmentId].filter((v) => v !== null).length;
}

/**
 * A store's current draft + committed filter.
 *
 * The whole `FilterState` object is returned rather than the two halves separately: its
 * identity only changes on a write, so `useSyncExternalStore`'s `Object.is` check is
 * satisfied without a selector that would mint a fresh tuple per read.
 */
export function useExerciseFilter(store: ExerciseFilterStore): FilterState {
  return useSyncExternalStore(store.subscribe, store.getState, store.getState);
}

/** True while the input has run ahead of the committed query. */
export function useIsQuerySettling(store: ExerciseFilterStore): boolean {
  const { draft, filter } = useExerciseFilter(store);
  return draft.trim() !== filter.query;
}
