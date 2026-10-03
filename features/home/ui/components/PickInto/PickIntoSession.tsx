import { PickExercisePage } from '@/features/exercises/pages';
import { usePickIntoSessionLogic } from '@/features/home/ui/components/PickInto/PickIntoSession.logic';

/** The picker, adding to the workout in progress and taking back what has nothing logged. */
export function PickIntoSession() {
  const { state, effects } = usePickIntoSessionLogic();
  return (
    <PickExercisePage
      isIncluded={effects.isIncluded}
      onUnpick={effects.unpick}
      lockedReason={effects.lockedReason}
      destination={state.destination}
      onPick={effects.pick}
      error={state.error}
    />
  );
}
