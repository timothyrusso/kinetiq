import type { Routine } from '@/features/routines';
import type { SessionPlan } from '@/features/workouts';

/** The plan a workout from `routine` starts from: its exercises in order, with their targets. */
export function planFromRoutine(routine: Routine): SessionPlan {
  return {
    routineId: routine.id,
    name: routine.name,
    items: routine.items.map(item => ({
      exerciseId: item.exerciseId,
      exerciseName: item.exerciseName,
      sets: item.sets,
      reps: item.reps,
      weightKg: item.weightKg,
      restSeconds: item.restSeconds,
      notes: item.notes,
    })),
  };
}
