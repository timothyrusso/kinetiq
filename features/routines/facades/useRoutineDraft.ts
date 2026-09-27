import { clamp, localId, moveItem } from '@/features/core/utils';
import { type Exercise, type ExerciseSnapshot, snapshotOf } from '@/features/exercises';
import type { ItemTarget } from '@/features/routines/domain/entities/ItemTarget';
import { defaultItemTarget } from '@/features/routines/domain/utils/itemTargets';
import { EMPTY_DRAFT, type RoutineDraft, useRoutineDraftStore } from '@/features/routines/state/routineDraftStore';
import type { NewRoutine } from '@/features/routines/useCases/createRoutine';

const store = useRoutineDraftStore;
const draft = (): RoutineDraft => store.getState();
const write = (patch: Partial<RoutineDraft>) => store.getState().patch(patch);

/** The latest rest a new row may get: ten minutes. */
const MAX_REST_SECONDS = 600;

/** Opens the builder on an empty draft; the previous, abandoned one never shows through. */
function open(defaultRestSeconds: number): void {
  write({ ...EMPTY_DRAFT, status: 'ready', defaultRestSeconds });
}

function setName(name: string): void {
  write({ name, touched: true });
}

/** Follows the user's rest setting; an equal value writes nothing. */
function setRestDefault(seconds: number): void {
  const next = clamp(Math.round(seconds), 0, MAX_REST_SECONDS);
  if (next !== draft().defaultRestSeconds) write({ defaultRestSeconds: next });
}

/** True when the draft already has a row for exercise `exerciseId`. */
function containsExercise(exerciseId: string): boolean {
  return draft().items.some(item => item.exerciseId === exerciseId);
}

/** The draft's snapshots with `snapshot` in them once, as the latest copy of its exercise. */
function withSnapshot(snapshots: readonly ExerciseSnapshot[], snapshot: ExerciseSnapshot): ExerciseSnapshot[] {
  return [...snapshots.filter(row => row.exerciseId !== snapshot.exerciseId), snapshot];
}

/**
 * Adds `exercise` with the opening targets and freezes its snapshot now, the moment it was
 * chosen. An exercise already in the draft is refused silently: the common case is a double tap,
 * and the picker marks the rows already in.
 */
function addExercise(exercise: Exercise, target?: Partial<ItemTarget>): void {
  if (containsExercise(exercise.id)) return;
  const current = draft();
  write({
    touched: true,
    items: [
      ...current.items,
      {
        id: localId('rit'),
        exerciseId: exercise.id,
        exerciseName: exercise.name,
        ...defaultItemTarget(current.defaultRestSeconds),
        ...target,
      },
    ],
    snapshots: withSnapshot(current.snapshots, snapshotOf(exercise, Date.now())),
  });
}

function updateItem(itemId: string, patch: Partial<ItemTarget>): void {
  write({ items: draft().items.map(item => (item.id === itemId ? { ...item, ...patch } : item)) });
}

/** Moves a row; a destination off the list moves nothing. */
function moveDraftItem(from: number, to: number): void {
  write({ items: moveItem(draft().items, from, to) });
}

/** Removes a row and keeps its snapshot, so the row can come back without a fetch. */
function removeItem(itemId: string): void {
  write({ items: draft().items.filter(item => item.id !== itemId) });
}

/** True when leaving would lose something: a saved draft loses nothing. */
function isDirty(): boolean {
  const current = draft();
  return current.status !== 'saved' && (current.items.length > 0 || current.name.trim().length > 0);
}

/** An unnamed routine with exercises can be saved; one with no exercises has no reason to exist. */
function isSavable(): boolean {
  const current = draft();
  return current.items.length > 0 && current.status !== 'saving';
}

/** The draft as the routine `useSaveRoutine` creates. */
function toNewRoutine(): NewRoutine {
  const current = draft();
  return { name: current.name, items: current.items, snapshots: current.snapshots };
}

/**
 * The builder's actions. Module-level, so every one is stable and reads the draft at call time:
 * the picker's double tap sees the row the first tap added.
 */
const actions = {
  open,
  setName,
  setRestDefault,
  addExercise,
  containsExercise,
  updateItem,
  moveItem: moveDraftItem,
  removeItem,
  clear: () => store.getState().reset(),
  markSaving: () => write({ status: 'saving' }),
  // NOTE: marked after a save, so a late unmount cannot make a finished draft dirty again.
  markSaved: () => write({ status: 'saved' }),
  markSaveFailed: () => write({ status: 'ready' }),
  isDirty,
  isSavable,
  toNewRoutine,
};

type RoutineDraftActions = typeof actions;

/** The new-routine draft, re-rendering on every change, and the actions that write it. */
export function useRoutineDraft(): { readonly draft: RoutineDraft; readonly actions: RoutineDraftActions } {
  const status = store.use.status();
  const touched = store.use.touched();
  const name = store.use.name();
  const items = store.use.items();
  const snapshots = store.use.snapshots();
  const defaultRestSeconds = store.use.defaultRestSeconds();
  return { draft: { status, touched, name, items, snapshots, defaultRestSeconds }, actions };
}
