import { useQueryClient } from '@tanstack/react-query';
import { useEffectMutation } from '@/features/core/query';
import { useSettings } from '@/features/settings';
import type { ActivityId } from '@/features/workouts/domain/schemas/ActivityId';
import { invalidateAfterWorkout } from '@/features/workouts/facades/workoutQueryKeys';
import { useSessionStore } from '@/features/workouts/state/sessionStore';
import { finishSession } from '@/features/workouts/useCases/finishSession';

/**
 * Records the workout in progress. The clock stops as the finish begins; once it is recorded the
 * store lets the session go and every read that shows it refreshes. A workout already in history
 * (`DuplicateWorkout`) wrote nothing but is finished all the same, so it lets go too; any other
 * failure keeps the session on screen to try again.
 */
export function useFinishSession() {
  const client = useQueryClient();
  const weeklyGoal = useSettings(settings => settings.weeklyGoalWorkouts);
  return useEffectMutation({
    mutationFn: ({ id }: { readonly id: ActivityId; readonly routineId: string | null }) =>
      finishSession(id, useSessionStore.getState().session, weeklyGoal),
    onMutate: () => useSessionStore.getState().beginFinish(),
    onSuccess: (_result, { id, routineId }) => {
      invalidateAfterWorkout(client, routineId);
      useSessionStore.getState().ended(id);
    },
    onError: (error, { id, routineId }) => {
      if (error._tag !== 'DuplicateWorkout' && error._tag !== 'NoActiveSession') return;
      invalidateAfterWorkout(client, routineId);
      if (error._tag === 'DuplicateWorkout') useSessionStore.getState().ended(id);
    },
  });
}
