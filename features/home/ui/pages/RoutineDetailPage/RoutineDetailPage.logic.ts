import { useStartWorkoutFromRoutine } from '@/features/home/facades/useStartWorkoutFromRoutine';

/** The routine page's way into a workout, which it cannot build itself: the workouts are a peer. */
export function useRoutineDetailPageLogic() {
  return { effects: { launcher: useStartWorkoutFromRoutine() } };
}
