import { useCallback, useMemo } from 'react';
import { planFromRoutine } from '@/features/home/facades/planFromRoutine';
import type { Routine, WorkoutLauncher } from '@/features/routines';
import { useRunningWorkoutName, useStartSession } from '@/features/workouts';

/**
 * The routine screen's way into a workout: the routine becomes the `SessionPlan` the workouts
 * start from. A routine with nothing in it is a real state (every exercise removed, not yet
 * deleted) and must not open an empty workout, so it reports `false`.
 */
export function useStartWorkoutFromRoutine(): WorkoutLauncher {
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
