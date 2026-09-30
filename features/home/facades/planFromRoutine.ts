import type { Routine } from '@/features/routines';
import type { SessionPlan } from '@/features/workouts';

/**
 * The plan a workout from `routine` starts from: its exercises in order, each naming its item and
 * each set planned from its own row of the routine, so the finish can write the workout back.
 */
export function planFromRoutine(routine: Routine): SessionPlan {
  return {
    routineId: routine.id,
    name: routine.name,
    items: routine.items.map(item => ({
      itemId: item.id,
      exerciseId: item.exerciseId,
      exerciseName: item.exerciseName,
      sets: item.sets.map(set => ({ reps: set.reps, weightKg: set.weightKg, targetRpe: set.targetRpe })),
      restSeconds: item.restSeconds,
      notes: item.notes,
    })),
  };
}
