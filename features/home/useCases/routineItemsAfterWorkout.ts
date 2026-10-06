import { type RoutineItem, type RoutineSet, routineItemOf, routineSetAs } from '@/features/routines';
import type { RoutineUpdate, StrengthEntry } from '@/features/workouts';

type WorkoutSet = StrengthEntry['sets'][number];

type Row = RoutineSet;

/** A done set as a routine row of its own type: its values, and its RPE as the row's target RPE. */
function rowFromSet(set: WorkoutSet, index: number): Row {
  const targetRpe = set.rpe !== null && set.rpe >= 0 && set.rpe <= 10 ? set.rpe : null;
  switch (set.type) {
    case 'weightReps':
      return { type: set.type, index, targetRpe, reps: Math.max(0, Math.round(set.reps)), weightKg: set.weightKg };
    case 'repsOnly':
      return { type: set.type, index, targetRpe, reps: Math.max(0, Math.round(set.reps)) };
    case 'duration':
      return { type: set.type, index, targetRpe, durationSeconds: Math.max(0, Math.round(set.durationSeconds)) };
  }
}

/**
 * The item's rows after the workout: one per set the workout kept, in its order, of the entry's
 * type. A done set writes its values; a set not done keeps the row it was planned from, carried
 * to the entry's type by the rules a workout changes a set's type with when the type changed
 * during the workout; one added during the workout and not done is not added. A row whose set
 * was removed during the workout goes.
 */
function rowsAfter(rows: readonly Row[], entry: StrengthEntry): Row[] {
  const sets: readonly WorkoutSet[] = entry.sets;
  return sets
    .flatMap((set): Row[] => {
      if (set.completed) return [rowFromSet(set, 0)];
      const planned = set.routineSetIndex === undefined ? undefined : rows[set.routineSetIndex];
      return planned === undefined ? [] : [routineSetAs(planned, entry.trackingType)];
    })
    .map((row, index) => ({ ...row, index }));
}

const hasDoneSet = (entry: StrengthEntry) => entry.sets.some(set => set.completed);

/**
 * The routine's items once a finished workout is written back into them (the finish's "Update
 * routine with today's values"), in the workout's order:
 *
 * - an exercise planned from an item, with a done set, takes the workout's tracking type and
 *   sets (`rowsAfter`), also when its type changed during the workout; one with no done set
 *   (skipped) keeps the item as it is, type included;
 * - an exercise added during the workout is added with its type and done sets, and not at all
 *   without one;
 * - an item the workout removed goes, and an item removed from the routine while the workout ran
 *   is never brought back;
 * - an item added to the routine while the workout ran, which the workout never had, is kept,
 *   after the workout's exercises.
 *
 * Rest and notes are never written: an item keeps its own, and an added exercise takes the rest
 * the workout gave it and no note. `newItemId` names each added item.
 */
export function routineItemsAfterWorkout(
  items: readonly RoutineItem[],
  update: RoutineUpdate,
  newItemId: () => string,
): RoutineItem[] {
  const byId = new Map(items.map(item => [item.id, item]));
  const planned = new Set(update.plannedItemIds);
  const fromWorkout = update.entries.flatMap((entry): RoutineItem[] => {
    if (entry.routineItemId !== undefined) {
      const item = byId.get(entry.routineItemId);
      if (item === undefined) return [];
      if (!hasDoneSet(entry)) return [item];
      const { trackingType: _type, sets: _sets, ...fields } = item;
      return [routineItemOf(fields, entry.trackingType, rowsAfter(item.sets, entry))];
    }
    const done: readonly WorkoutSet[] = entry.sets.filter((set: WorkoutSet) => set.completed);
    if (done.length === 0) return [];
    return [
      routineItemOf(
        {
          id: newItemId(),
          exerciseId: entry.exerciseId,
          exerciseName: entry.exerciseName,
          restSeconds: entry.restSeconds,
          notes: null,
        },
        entry.trackingType,
        done.map(rowFromSet),
      ),
    ];
  });
  const inWorkout = new Set(update.entries.flatMap(entry => entry.routineItemId ?? []));
  const addedMeanwhile = items.filter(item => !inWorkout.has(item.id) && !planned.has(item.id));
  return [...fromWorkout, ...addedMeanwhile];
}
