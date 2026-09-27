import { PickExercisePage } from '@/features/exercises/pages';
import { usePickIntoSessionLogic } from '@/features/home/ui/components/PickInto/PickIntoSession.logic';

/** The picker, adding to the workout in progress. */
export function PickIntoSession() {
  const { state, effects } = usePickIntoSessionLogic();
  return <PickExercisePage isIncluded={effects.isIncluded} onPick={effects.pick} error={state.error} />;
}
