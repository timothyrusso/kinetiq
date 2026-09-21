/**
 * The exercise browser's filter state, as an external store.
 *
 * ## Why not component state
 *
 * Three screens read and write it: the Exercises tab (search box, chips), the filter sheet
 * (category / muscle / equipment), and an exercise's detail screen ("more like this",
 * which narrows to that exercise's muscle group). Kept in the tab, that means either
 * prop-drilling through a router that passes no props, or serialising the whole filter into
 * the URL: and a URL-borne filter means every chip tap rewrites history, so the back
 * gesture walks backwards through filter changes instead of out of the screen. Back should
 * leave. A store makes the filter the app-level fact it actually is: it survives the round
 * trip to a detail screen, which is what every real fitness app does and what a user
 * expects after they have taken the trouble to set "Chest" twice.
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

type FilterState = {
  /** Exactly what the search input shows. */
  draft: string;
  /** What queries key on. Settles after the draft. */
  filter: ExerciseFilter;
};

let state: FilterState = { draft: '', filter: emptyFilter() };
const listeners = new Set<() => void>();
let timer: ReturnType<typeof setTimeout> | null = null;

function emit(): void {
  for (const listener of listeners) listener();
}

function commit(patch: Partial<ExerciseFilter>): void {
  if (timer !== null) {
    clearTimeout(timer);
    timer = null;
  }
  state = { draft: patch.query ?? state.draft, filter: { ...state.filter, ...patch } };
  emit();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * Text changed: update the input at once, and schedule the query change.
 *
 * The trailing-commit form (rather than leading) is deliberate. Leading-edge would fire a
 * request for the first character typed, which for a fuzzy `name__search` is the slowest
 * possible query and the least likely one the user meant to run.
 */
export function setExerciseQuery(draft: string): void {
  state = { ...state, draft };
  emit();
  if (timer !== null) clearTimeout(timer);
  timer = setTimeout(() => {
    timer = null;
    commit({ query: draft.trim() });
  }, COMMIT_DELAY_MS);
}

export function setExerciseCategoryId(categoryId: number | null): void {
  commit({ categoryId });
}

export function setExerciseMuscleId(muscleId: number | null): void {
  commit({ muscleId });
}

export function setExerciseEquipmentId(equipmentId: number | null): void {
  commit({ equipmentId });
}

/** Clears everything, including any pending commit, "Clear filters" is instant. */
export function resetExerciseFilter(): void {
  if (timer !== null) {
    clearTimeout(timer);
    timer = null;
  }
  state = { draft: '', filter: emptyFilter() };
  emit();
}

/** How many of the three taxonomy filters are doing something. */
export function activeFilterCount(filter: ExerciseFilter): number {
  return [filter.categoryId, filter.muscleId, filter.equipmentId].filter((v) => v !== null).length;
}

export function getExerciseFilterState(): FilterState {
  return state;
}

/**
 * The current draft + committed filter.
 *
 * The whole `FilterState` object is returned rather than the two halves separately: its
 * identity only changes on a write, so `useSyncExternalStore`'s `Object.is` check is
 * satisfied without a selector that would mint a fresh tuple per read.
 */
export function useExerciseFilter(): FilterState {
  return useSyncExternalStore(subscribe, getExerciseFilterState, getExerciseFilterState);
}

/** True while the input has run ahead of the committed query. */
export function useIsQuerySettling(): boolean {
  const { draft, filter } = useExerciseFilter();
  return draft.trim() !== filter.query;
}
