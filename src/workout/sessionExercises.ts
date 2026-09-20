/**
 * Putting an exercise into a workout that is already running.
 *
 * ## Why a function in the workout module and not a call from the screen
 *
 * Three things have to happen together, and the screen has no business knowing the order:
 * the exercise must be frozen into the local `exercises` table, an entry must be built in
 * the shape the session engine accepts, and the pointer must move to the new row. Two of the
 * three are persistence writes. Doing that inline in a press handler is how persistence logic
 * ends up scattered across UI components, and it is the same reason `useStartRoutine` exists
 * one file over.
 *
 * ## The freeze is not optional
 *
 * `upsertSnapshot` is the whole reason a completed workout is still readable in five years.
 * The activity recorded at finish time stores `exerciseId` plus the name; the details screen
 * resolves id → snapshot. Freeze nothing, and a mid-workout addition becomes a row that can
 * never be looked up once the provider's cache is gone — with nothing stored to repair it
 * from. Upsert rather than insert, because an exercise added to a routine earlier is already
 * in the table, and re-freezing it is correct (same current data), not a conflict.
 *
 * ## One await, and the order around it
 *
 * The engine's contract is that a mutation has landed in SQLite before the call returns (see
 * `@/workout/session`), so the snapshot write is awaited *before* `addExercise` publishes: by
 * the time the row is visible on screen, the row that makes it readable also exists. That
 * first write is the only asynchronous step, and it is the only one worth a `try` at the call
 * site — a failure propagates rather than being swallowed, because "it did not appear" and "it
 * appeared but its details are gone forever" are different failures, and only the second one
 * is silent.
 */
import { entriesFromItems } from '@/queries/useRoutines';
import { snapshotOf, upsertSnapshot } from '@/persistence/routineRepository';
import { defaultItemTarget, toDraftItem } from '@/routines/draft';
import { addExercise, getActiveSession, setActiveIndex } from '@/workout/session';
import type { Exercise } from '@/domain/types';

export type AddSessionExerciseInput = {
  /** A provider row — resolved, not just an id: the freeze needs the data it carries. */
  exercise: Exercise;
  /**
   * The user's preferred rest, used only because an exercise arriving from the live library
   * carries no programmed rest of its own. Passing the setting rather than a literal means a
   * row added between sets rests like every row the user programmed themselves.
   */
  defaultRestSeconds: number;
  /** The picker disables those rows, but a double-tap can still arrive; no-op if so. */
  isDuplicate?: boolean;
};

/**
 * Returns whether the exercise landed.
 *
 * `false` means there was no session to add to, which the caller can say out loud. Doing
 * nothing quietly is the failure mode worth designing against: the button was pressed, the
 * sheet closed, and the list did not change.
 */
export async function addExerciseToSession(
  input: AddSessionExerciseInput,
): Promise<boolean> {
  if (input.isDuplicate === true) return false;
  if (getActiveSession() === null) return false;

  await upsertSnapshot(snapshotOf(input.exercise));

  // Re-checked after the await: the sheet stays open over the session screen, so the workout
  // can have been discarded or finished while that write was in flight. `addExercise` guards
  // this too, but silently — returning `true` here would then report success for a workout
  // that no longer exists.
  const live = getActiveSession();
  if (live === null) return false;

  // One item through the same builder a real workout starts from, so a row added mid-session
  // cannot come out shaped differently from one the routine would have produced — same rep
  // parsing, same 1RM pass, same set numbering.
  const item = toDraftItem(
    input.exercise.id,
    input.exercise.name,
    defaultItemTarget(input.defaultRestSeconds),
  );
  const [entry] = entriesFromItems([item]);
  if (!entry) return false;

  addExercise(entry);
  // Jump to it: adding an exercise mid-workout is a decision to train it, and leaving the
  // pointer on the previous row would put the next tap on the wrong exercise. The engine
  // clamps, so passing the post-append length is enough to land on the new last row.
  setActiveIndex(live.entries.length);
  return true;
}
