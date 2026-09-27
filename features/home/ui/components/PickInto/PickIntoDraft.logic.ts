import { useCallback } from 'react';
import { haptics } from '@/features/core/haptics';
import type { Exercise } from '@/features/exercises';
import { useRoutineDraft } from '@/features/routines';

/** Picks into the routine builder's draft. Subscribed, so the included marks follow the adds. */
export function usePickIntoDraftLogic() {
  const { actions } = useRoutineDraft();
  const pick = useCallback(
    (exercise: Exercise) => {
      actions.addExercise(exercise);
      haptics.success();
    },
    [actions],
  );
  return { effects: { pick, isIncluded: actions.containsExercise } };
}
