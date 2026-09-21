/**
 * The new-routine builder's state: an external store, not a screen's `useState`.
 *
 * ## Why the builder's draft cannot live in the screen
 *
 * The builder is a modal. Modals in this app get keyboard-avoidance treatment, and more to
 * the point a user mid-way through assembling five exercises can background the app to
 * check a previous weight: the exact scenario the brief calls out as must-not-lose. A
 * `useState` array goes with the unmounted tree.
 *
 * The second reason is subtler and is the one that decides the shape: *the sheet*. Adding an
 * exercise opens a sheet over the builder that searches the remote library and writes into
 * the same list. Held in component state, that needs either a callback prop threaded through
 * the sheet or a lifted state above both, which turns the builder into a parent whose only
 * job is to hold an array. Held in a store, the sheet writes directly and the builder
 * re-renders because it subscribes.
 *
 * ## What is deliberately *not* here
 *
 * No persistence, and no autosave. A half-built routine is not data the user asked to keep:
 * they pressed "New routine", and if they back out of it, the correct outcome is that
 * nothing was created. The screen asks for confirmation instead: see `isDirty`. Persisting
 * drafts would also mean a restore path, a "resume draft" affordance, and a cleanup rule for
 * drafts nobody returns to, which is three problems to solve a case the confirm prompt
 * already covers. This is the one place in the app where *not* persisting is the correct
 * lifecycle answer, and the reason is that nothing has been created yet.
 *
 * ## Snapshot, not reducer
 *
 * Same shape as the workout session store (see `src/workout/session.ts`): a module singleton,
 * a listener set, and actions that are plain functions rather than dispatched actions. The
 * alternative is genuinely reasonable here and was rejected on line count: a reducer plus an
 * action union for eleven operations is ~90 lines of plumbing whose only benefit: a
 * serialisable log of every transition: is not something any screen reads.
 */
import { useSyncExternalStore } from 'react';

import type { Exercise, ExerciseSnapshot, RoutineItem } from '@/domain/types';
import { snapshotOf } from '@/persistence';
import { clamp, localId, moveItem } from '@/utils/functional';
import {
  defaultItemTarget,
  toDraftItem,
  type ItemTarget,
} from '@/routines/draft';

export type DraftStatus = 'idle' | 'ready' | 'saving' | 'saved';

export type RoutineDraftState = {
  /** Null until the first exercise is added or the name is typed: the empty state. */
  status: DraftStatus;
  /** Set once the user has typed a name or added a row; drives the discard prompt. */
  touched: boolean;
  name: string;
  /**
   * The text field's own value, so empty means empty rather than null: a controlled
   * `TextInput` cannot take null, and storing null here would mean every read writes
   * `?? ''` at the field. `draftToPayload` converts the empty string back to null, which is
   * what the column stores.
   */
  description: string;
  items: RoutineItem[];
  /**
   * Frozen library data for the exercises added from the remote search, keyed by exercise id.
   * An array in insertion order because that is the shape `RoutineDraft.snapshots` takes, * saving is a pass-through rather than a conversion.
   */
  snapshots: ExerciseSnapshot[];
  /** Rest seconds to give a newly added row; the caller seeds it from Settings. */
  defaultRestSeconds: number;
};

const EMPTY: RoutineDraftState = {
  status: 'idle',
  touched: false,
  name: '',
  description: '',
  items: [],
  snapshots: [],
  defaultRestSeconds: 90,
};

let state: RoutineDraftState = EMPTY;
const listeners = new Set<() => void>();

function emit(): void {
  for (const listener of listeners) listener();
}

function set(patch: Partial<RoutineDraftState>): void {
  state = { ...state, ...patch };
  emit();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * Whole-state read, which is what makes this hook re-render on any change.
 *
 * The getSnapshot function must be referentially stable and must return the same object for
 * the same state, or `useSyncExternalStore` spins forever. Returning the module `state`
 * variable satisfies both: it is only ever replaced wholesale, never mutated.
 *
 * A selector variant is deliberately absent. The builder is one screen with ~10 rows and a
 * header; a per-field subscription would save negligible work and would make the ordering
 * of a multi-field write (open sheet → edit → close) harder to reason about.
 */
export function useRoutineDraft(): RoutineDraftState {
  return useSyncExternalStore(subscribe, () => state, () => EMPTY);
}

/** Non-hook read for non-component code (the `beforeRemove` guard needs it outside render). */
export function getRoutineDraft(): RoutineDraftState {
  return state;
}

/* ------------------------------------------------------------------ actions -- */

/**
 * Open the builder.
 *
 * Always resets first. Leaving the previous draft behind is the bug where you add an
 * exercise, back out, press New routine again and find the old list: with a name that
 * belongs to a routine you cancelled.
 *
 * There is deliberately no "seed this from an existing routine" option. Duplicating a
 * routine means copying its rows *and* its frozen snapshots, and only
 * `routineRepository.duplicate` can see both in one transaction; an earlier version of this
 * store accepted pre-seeded items and rebuilt them here, dropped the snapshots on the floor,
 * and quietly broke the offline guarantee for exactly the routines people duplicate most.
 * A builder that can only build is the smaller, correct surface.
 */
export function openDraft(input: { defaultRestSeconds: number }): void {
  set({ ...EMPTY, status: 'ready', defaultRestSeconds: input.defaultRestSeconds });
}

export function setDraftName(name: string): void {
  set({ name, touched: true });
}

export function setDraftDescription(description: string): void {
  set({ description });
}

export function setDraftRestDefault(seconds: number): void {
  set({ defaultRestSeconds: clamp(Math.round(seconds), 0, 600) });
}

/**
 * Add an exercise to the draft.
 *
 * Returns nothing, but refuses a duplicate silently: see `containsExercise`. The snapshot
 * is frozen here, at the moment the user chose the exercise, which is the same rule the
 * saved-routine path uses (`useAddRoutineExercise` calls `snapshotOf` in its mutation): the
 * point is that the routine you built from wger data in October still shows that data in
 * March, whether or not wger is reachable or has changed the entry.
 */
export function addDraftExercise(exercise: Exercise, target?: Partial<ItemTarget>): void {
  if (containsExercise(exercise.id)) return;
  const base = defaultItemTarget(state.defaultRestSeconds);
  const item = toDraftItem(exercise.id, exercise.name, { ...base, ...target });
  set({
    touched: true,
    items: [...state.items, item],
    snapshots: upsertSnapshotRow(state.snapshots, snapshotOf(exercise)),
  });
}

/**
 * True when the draft already has a row for this exercise.
 *
 * Silent refusal rather than a toast. Two rows of Bench Press is a plausible plan (a heavy
 * compound block and a lighter one), so blocking it outright would be wrong; but the common
 * case is a double-tap on the same search result, and a duplicate row appearing is worse
 * than nothing happening. The sheet dims rows already in the draft so the case is visible
 * before the tap, which is the part that makes silent refusal honest rather than confusing.
 */
export function containsExercise(exerciseId: string): boolean {
  return state.items.some((item) => item.exerciseId === exerciseId);
}

export function updateDraftItem(itemId: string, patch: Partial<ItemTarget>): void {
  set({
    items: state.items.map((item) =>
      item.id === itemId ? { ...item, ...patch } : item,
    ),
  });
}

/**
 * Move a row.
 *
 * The generic `moveItem` returns an unchanged copy for an out-of-range destination rather
 * than clamping. That is right here: the only destinations come from the row's own up/down
 * controls, which are disabled at the ends of the list, so the case is unreachable: and if
 * it were ever reached, "nothing moved" beats "moved somewhere the user did not ask".
 */
export function moveDraftItem(from: number, to: number): void {
  set({ items: moveItem(state.items, from, to) });
}

export function removeDraftItem(itemId: string): void {
  set({
    items: state.items.filter((item) => item.id !== itemId),
    // Snapshots are kept, not garbage-collected: a row the user removed a moment ago may
    // come back, and the frozen data is small. Pruning it would mean re-fetching to redraw
    // the same row, which is the offline guarantee spent for a few kilobytes.
  });
}

/** Duplicate a row directly below itself: the fastest way to build a superset progression. */
export function duplicateDraftItem(itemId: string): void {
  const index = state.items.findIndex((item) => item.id === itemId);
  const source = state.items[index];
  if (source === undefined) return;
  const copy = { ...source, id: localId('rit') };
  const next = [...state.items];
  next.splice(index + 1, 0, copy);
  set({ items: next });
}

export function clearDraft(): void {
  set(EMPTY);
}

/** Called after a successful save, so a late unmount cannot re-dirty a finished draft. */
export function markDraftSaved(): void {
  set({ status: 'saved' });
}

export function markDraftSaving(): void {
  set({ status: 'saving' });
}

/** An error surfaced by the save: return the draft to an editable state. */
export function markDraftSaveFailed(): void {
  set({ status: 'ready' });
}

/* ------------------------------------------------------------------ queries -- */

/**
 * True when leaving would lose something.
 *
 * A typed space in the name field counts. That sounds strict, and it is the right trade:
 * the prompt's cost is one tap for someone who meant to cancel, and not prompting's cost is
 * a lost ten-minute routine. What makes it tolerable is that the check is on
 * `touched`, so merely *opening* the builder: browsing it, closing it: never prompts.
 */
export function isDraftDirty(): boolean {
  return state.items.length > 0 || state.name.trim().length > 0;
}

/**
 * Whether the Done button can write.
 *
 * An unnamed routine with no exercises has no reason to exist; an unnamed routine *with*
 * exercises does (the name can be fixed later, and the default is derived from the first
 * exercise). So the list, not the name, is the gate: and the name field shows a hint
 * rather than an error, because requiring a name before allowing any work is how forms
 * discourage people from starting.
 */
export function isDraftSavable(): boolean {
  return state.items.length > 0 && state.status !== 'saving';
}

/** The payload `useSaveRoutine` takes. `items`/`snapshots` are pass-through by design. */
export function draftToPayload(): {
  name: string;
  description: string | null;
  items: RoutineItem[];
  snapshots: ExerciseSnapshot[];
} {
  const name = state.name.trim();
  return {
    // A routine of squats called nothing should be called Squats. Derived at save rather
    // than typed into the field, so the user can still overwrite it and the field never
    // shows text they did not write.
    name: name.length > 0 ? name : derivedName(state.items),
    description: state.description.trim().length > 0 ? state.description.trim() : null,
    items: state.items,
    snapshots: state.snapshots,
  };
}

/**
 * A name for a routine the user did not name.
 *
 * The first exercise plus the row count reads as a real routine list's auto-title and stays
 * unique enough to tell apart in a list of five.
 */
export function derivedName(items: readonly RoutineItem[]): string {
  const first = items[0]?.exerciseName ?? 'New routine';
  return items.length > 1 ? `${first} + ${items.length - 1} more` : first;
}

/* -------------------------------------------------------------------- utils -- */

function upsertSnapshotRow(
  rows: readonly ExerciseSnapshot[],
  snapshot: ExerciseSnapshot,
): ExerciseSnapshot[] {
  const next = rows.filter((row) => row.exerciseId !== snapshot.exerciseId);
  return [...next, snapshot];
}
