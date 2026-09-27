/**
 * Starting a workout from a routine: the mapping of a `Routine` to the `SessionPlan` a workout
 * starts from. Neither feature may import the other (they are peers), so the mapping lives above
 * both; this legacy shim holds it until the tier-4 home feature does (#54).
 */
import { useCallback, useMemo } from 'react';
import type { Routine, WorkoutLauncher } from '@/features/routines';
import { type SessionPlan, useRunningWorkoutName, useStartSession } from '@/features/workouts';

/** The plan a workout from `routine` starts from: its exercises in order, with their targets. */
function planFromRoutine(routine: Routine): SessionPlan {
  return {
    routineId: routine.id,
    name: routine.name,
    items: routine.items.map((item) => ({
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

/**
 * The routine screen's way into a workout. A routine with nothing in it is a real state (every
 * exercise removed, not yet deleted) and must not open an empty workout, so it reports `false`.
 */
export function useWorkoutLauncher(): WorkoutLauncher {
  const runningName = useRunningWorkoutName();
  const { start: startSession, busy } = useStartSession();
  const start = useCallback(
    (routine: Routine, onResult: (started: boolean) => void) => {
      if (routine.items.length === 0) {
        onResult(false);
        return;
      }
      startSession(planFromRoutine(routine), () => onResult(true));
    },
    [startSession],
  );
  return useMemo(
    () => ({ running: runningName === null ? null : { name: runningName }, starting: busy, start }),
    [busy, runningName, start],
  );
}
