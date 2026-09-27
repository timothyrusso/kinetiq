import { useCallback } from 'react';
import { useEffectMutation } from '@/features/core/query';
import type { Exercise } from '@/features/exercises';
import { useSessionStore } from '@/features/workouts/state/sessionStore';
import { addSessionExercise, type ExerciseTarget } from '@/features/workouts/useCases/addSessionExercise';

/**
 * Puts an exercise into the workout in progress and makes it the current one: adding an exercise
 * mid-workout is a decision to train it. `add` resolves `false` when the list did not change (no
 * workout, or it was already in it) and rejects when the exercise could not be stored.
 */
export function useAddSessionExercise() {
  const { mutateAsync } = useEffectMutation({
    mutationFn: ({ exercise, target }: { readonly exercise: Exercise; readonly target: ExerciseTarget }) =>
      addSessionExercise(exercise, target),
  });
  const add = useCallback(
    async (exercise: Exercise, target: ExerciseTarget, isDuplicate: boolean): Promise<boolean> => {
      if (isDuplicate || useSessionStore.getState().session === null) return false;
      const entry = await mutateAsync({ exercise, target });
      // NOTE: re-read after the write: the sheet stays open over the session, so the workout can
      // have been finished or discarded while the exercise was being stored.
      const live = useSessionStore.getState().session;
      if (live === null) return false;
      const now = Date.now();
      useSessionStore.getState().addExercise(entry, now);
      useSessionStore.getState().focus(live.entries.length, now);
      return true;
    },
    [mutateAsync],
  );
  return { add };
}
