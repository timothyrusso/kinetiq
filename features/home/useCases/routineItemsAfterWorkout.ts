import type { RoutineItem, RoutineSet } from '@/features/routines';
import type { RoutineUpdate, StrengthEntry } from '@/features/workouts';

type WorkoutSet = StrengthEntry['sets'][number];

/** A done set as a routine row: its reps, load and RPE, which becomes the row's target RPE. */
function rowFromSet(set: WorkoutSet): Omit<RoutineSet, 'index'> {
  const rpe = set.rpe !== null && set.rpe >= 0 && set.rpe <= 10 ? set.rpe : null;
  // HACK: a routine row holds weight and reps only until it carries its tracking type (#191): a
  // reps-only set writes back at bodyweight and a timed one as 0 reps at bodyweight.
  const reps = set.type === 'duration' ? 0 : set.reps;
  const weightKg = set.type === 'weightReps' ? set.weightKg : 0;
  return { reps: Math.max(0, Math.round(reps)), weightKg, targetRpe: rpe };
}

/**
 * The item's rows after the workout: one per set the workout kept, in its order. A done set
 * writes its values; a set not done keeps the row it was planned from, and one added during the
 * workout and not done is not added. A row whose set was removed during the workout goes.
 */
function rowsAfter(rows: readonly RoutineSet[], sets: readonly WorkoutSet[]): RoutineSet[] {
  return sets
    .flatMap(set => {
      if (set.completed) return [rowFromSet(set)];
      const planned = set.routineSetIndex === undefined ? undefined : rows[set.routineSetIndex];
      return planned === undefined ? [] : [planned];
    })
    .map((row, index) => ({ ...row, index }));
}

const hasDoneSet = (entry: StrengthEntry) => entry.sets.some(set => set.completed);

/**
 * The routine's items once a finished workout is written back into them (the finish's "Update
 * routine with today's values"), in the workout's order:
 *
 * - an exercise planned from an item, with a done set, takes the workout's sets (`rowsAfter`);
 *   one with no done set (skipped) keeps the item as it is;
 * - an exercise added during the workout is added with its done sets, and not at all without one;
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
      return [hasDoneSet(entry) ? { ...item, sets: rowsAfter(item.sets, entry.sets) } : item];
    }
    const done = entry.sets.filter(set => set.completed);
    if (done.length === 0) return [];
    return [
      {
        id: newItemId(),
        exerciseId: entry.exerciseId,
        exerciseName: entry.exerciseName,
        sets: done.map((set, index) => ({ ...rowFromSet(set), index })),
        restSeconds: entry.restSeconds,
        notes: null,
      },
    ];
  });
  const inWorkout = new Set(update.entries.flatMap(entry => entry.routineItemId ?? []));
  const addedMeanwhile = items.filter(item => !inWorkout.has(item.id) && !planned.has(item.id));
  return [...fromWorkout, ...addedMeanwhile];
}
