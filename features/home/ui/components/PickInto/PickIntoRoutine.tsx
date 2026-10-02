import { PickExercisePage } from '@/features/exercises/pages';
import { usePickIntoRoutineLogic } from '@/features/home/ui/components/PickInto/PickIntoRoutine.logic';
import type { RoutineId } from '@/features/routines';

/** The picker, adding to a saved routine and removing from it. */
export function PickIntoRoutine({ routineId }: { routineId: RoutineId }) {
  const { state, effects } = usePickIntoRoutineLogic(routineId);
  return (
    <PickExercisePage
      isIncluded={effects.isIncluded}
      destination={state.destination}
      onPick={effects.pick}
      onUnpick={effects.unpick}
      error={state.error}
    />
  );
}
