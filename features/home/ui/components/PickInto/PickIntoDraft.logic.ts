import { useCallback, useMemo } from 'react';
import { haptics } from '@/features/core/haptics';
import type { Exercise } from '@/features/exercises';
import type { PickDestination } from '@/features/exercises/pages';
import { useRoutineDraft } from '@/features/routines';

const DESTINATION: PickDestination = 'routine';

/**
 * Picks into the routine builder's draft. Subscribed, so the included marks follow the adds:
 * `isIncluded` is rebuilt from the draft's rows, and the picker's list re-renders its rows only
 * when it changes.
 */
export function usePickIntoDraftLogic() {
  const { draft, actions } = useRoutineDraft();
  const ids = useMemo(() => draft.items.map(item => item.exerciseId), [draft.items]);
  const isIncluded = useCallback((exerciseId: string) => ids.includes(exerciseId), [ids]);
  const pick = useCallback(
    (exercise: Exercise) => {
      actions.addExercise(exercise);
      haptics.success();
    },
    [actions],
  );
  return { state: { destination: DESTINATION }, effects: { pick, isIncluded } };
}
