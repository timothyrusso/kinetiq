import type { Routine, RoutineItem } from '@/features/routines';
import type { SessionPlan } from '@/features/workouts';

type PlanItem = SessionPlan['items'][number];

/** The item's sets as the plan's, of the item's own type, each opening on its row's targets. */
function planItemOf(item: RoutineItem): PlanItem {
  const fields = {
    itemId: item.id,
    exerciseId: item.exerciseId,
    exerciseName: item.exerciseName,
    restSeconds: item.restSeconds,
    notes: item.notes,
  };
  switch (item.trackingType) {
    case 'weightReps':
      return {
        ...fields,
        trackingType: item.trackingType,
        sets: item.sets.map(set => ({
          type: set.type,
          reps: set.reps,
          weightKg: set.weightKg,
          targetRpe: set.targetRpe,
        })),
      };
    case 'repsOnly':
      return {
        ...fields,
        trackingType: item.trackingType,
        sets: item.sets.map(set => ({ type: set.type, reps: set.reps, targetRpe: set.targetRpe })),
      };
    case 'duration':
      return {
        ...fields,
        trackingType: item.trackingType,
        sets: item.sets.map(set => ({
          type: set.type,
          durationSeconds: set.durationSeconds,
          targetRpe: set.targetRpe,
        })),
      };
  }
}

/**
 * The plan a workout from `routine` starts from: its exercises in order, each naming its item and
 * keeping its tracking type, and each set planned from its own row of the routine, so the finish
 * can write the workout back.
 */
export function planFromRoutine(routine: Routine): SessionPlan {
  return { routineId: routine.id, name: routine.name, items: routine.items.map(planItemOf) };
}
