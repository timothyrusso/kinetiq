import { PickExercisePage } from '@/features/exercises/pages';
import { usePickIntoDraftLogic } from '@/features/home/ui/components/PickInto/PickIntoDraft.logic';

/** The picker, adding to the routine builder's draft. */
export function PickIntoDraft() {
  const { effects } = usePickIntoDraftLogic();
  return <PickExercisePage isIncluded={effects.isIncluded} onPick={effects.pick} error={null} />;
}
