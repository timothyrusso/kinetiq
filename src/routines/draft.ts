/**
 * Identity and structure for a routine's exercise rows.
 *
 * ## Why this is a module and not screen code
 *
 * Two screens assemble the same list — the new-routine builder (in memory, saved once) and
 * the routine screen (already on disk, written per change) — and both need to turn a chosen
 * exercise into a row, and a list of rows into the shape the repository and the reorder
 * mutation take. Duplicating that across two files means one of them drifts, and drift here
 * is a data bug, not a visual one: two defaults for a new row, or two orders sent to the
 * database.
 *
 * Everything here is a pure function over `RoutineItem`. Nothing reads a store, a database
 * or a hook, which is what lets both screens share it without either borrowing the other's
 * persistence model. The draft *state* is a separate module (`draftStore`); this one is just
 * the rules.
 *
 * ## What deliberately lives elsewhere
 *
 * - Volume, reps and duration: `domain/logic`, beside the performed-set counterparts they are
 *   compared against. They were here first, which put a routine's planned volume in a
 *   different file from the same routine's completed volume.
 * - Reordering: the generic `moveItem` in `utils/functional`. A version of this module
 *   carried its own that clamped an out-of-range destination, written for a drag-to-reorder
 *   row that was then rejected — with up/down controls disabled at the ends of the list, the
 *   clamp was unreachable code defended by a comment describing a gesture the app does not
 *   have.
 * - Which number a rep range means: `utils/format`'s `repsFromRange`, the single answer the
 *   steppers, the estimates and the workout engine all read.
 *
 * ## The draft item *is* a `RoutineItem`
 *
 * Unsaved rows use the same type as saved ones, with an id minted at insertion time rather
 * than at save time. An earlier shape that deferred ids until save looked tidier and was
 * worse in three ways: a `key` prop had to fall back to the array index (exactly the
 * unstable-key bug that corrupts a reorder), every handler needed an `id | index` union, and
 * `RoutineDraft.items` could not be assigned without a cast. `routineRepository.save`
 * inserts the ids it is handed and mints one only when `draft.id` is absent, so pre-minting
 * item ids is compatible with it by design.
 */
import type { ExerciseSnapshot, RoutineItem } from '@/domain/types';
import { localId } from '@/utils/functional';

/**
 * What a caller must supply to put an exercise into a routine: exactly the `RoutineItem`
 * fields that are *not* derived from the exercise itself. That is also the variable shape
 * `useAddRoutineExercise` takes, so the remote "add to routine" path and the local builder
 * cannot drift apart on defaults.
 */
export type ItemTarget = Pick<
  RoutineItem,
  'sets' | 'reps' | 'weightKg' | 'restSeconds' | 'notes'
>;

/**
 * The sensible opening plan: 3 × 8-12 at bodyweight, resting at the user's default.
 *
 * Three-by-eight-to-twelve rather than a single number because it is what a first row on a
 * strength app conventionally offers, and because a range survives being trained at
 * different efforts on different days without the user editing the routine.
 */
export function defaultItemTarget(defaultRestSeconds: number): ItemTarget {
  return {
    sets: 3,
    reps: '8-12',
    weightKg: 0,
    restSeconds: defaultRestSeconds,
    notes: null,
  };
}

/**
 * A target plus the exercise it belongs to, in the shape a routine list holds.
 *
 * The name is stored on the row, not looked up: `exerciseName` is what lets a saved routine
 * still render its rows when no snapshot was ever frozen — an older row, a row imported
 * before snapshots existed, or one whose remote exercise has since vanished. Drawing the row
 * would otherwise mean inventing a label, and inventing exercise data is the one thing this
 * app does not do.
 */
export function toDraftItem(
  exerciseId: string,
  exerciseName: string,
  target: ItemTarget,
): RoutineItem {
  return {
    id: localId('rit'),
    exerciseId,
    exerciseName,
    sets: target.sets,
    reps: target.reps,
    weightKg: target.weightKg,
    restSeconds: target.restSeconds,
    notes: target.notes,
  };
}

/** Ordered ids for `useReorderRoutine`, which takes the whole list rather than a move. */
export function orderedIdsOf(items: readonly RoutineItem[]): string[] {
  return items.map((item) => item.id);
}

/** A row plus the frozen library data behind it, which may legitimately be absent. */
export type ItemRow = {
  item: RoutineItem;
  /** Null when no snapshot was ever stored for this exercise — see the row's fallback. */
  snapshot: ExerciseSnapshot | null;
};

/**
 * Pair a routine's rows with their snapshots.
 *
 * A plain map lookup per row rather than a join at the query layer, because the two arrive
 * from different repository calls and the caller already holds both. The pairing is a
 * function rather than inline `map` at two call sites so that "missing snapshot is null, not
 * undefined, and not a crash" is stated once.
 */
export function pairItems(
  items: readonly RoutineItem[],
  snapshots: ReadonlyMap<string, ExerciseSnapshot>,
): ItemRow[] {
  return items.map((item) => ({ item, snapshot: snapshots.get(item.exerciseId) ?? null }));
}
