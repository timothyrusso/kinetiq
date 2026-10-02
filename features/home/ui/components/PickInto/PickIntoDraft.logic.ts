import { useCallback, useMemo } from 'react';
import { haptics } from '@/features/core/haptics';
import type { Exercise } from '@/features/exercises';
import type { PickDestination } from '@/features/exercises/pages';
import { useRoutineDraft } from '@/features/routines';

const DESTINATION: PickDestination = 'routine';

/**
 * Picks into the routine builder's draft. Subscribed, so the included marks follow the adds:
 * `isIncluded` is rebuilt from the draft's rows, and the picker's list re-renders its rows only
 * when it changes. A tap on an included exercise removes its row through the builder's own
 * `removeItem`, as the row's remove action on the builder does.
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
  const unpick = useCallback(
    (exerciseId: string) => {
      const item = draft.items.findLast(row => row.exerciseId === exerciseId);
      if (item === undefined) return;
      actions.removeItem(item.id);
      haptics.light();
    },
    [actions, draft.items],
  );
  return { state: { destination: DESTINATION }, effects: { pick, unpick, isIncluded } };
}
