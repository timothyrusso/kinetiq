import { PickExercisePage } from '@/features/exercises/pages';
import { usePickIntoDraftLogic } from '@/features/home/ui/components/PickInto/PickIntoDraft.logic';

/** The picker, adding to the routine builder's draft and removing from it. */
export function PickIntoDraft() {
  const { state, effects } = usePickIntoDraftLogic();
  return (
    <PickExercisePage
      isIncluded={effects.isIncluded}
      destination={state.destination}
      onPick={effects.pick}
      onUnpick={effects.unpick}
      error={null}
    />
  );
}
