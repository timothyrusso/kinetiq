import { PickIntoDraft } from '@/features/home/ui/components/PickInto/PickIntoDraft';
import { PickIntoRoutine } from '@/features/home/ui/components/PickInto/PickIntoRoutine';
import { PickIntoSession } from '@/features/home/ui/components/PickInto/PickIntoSession';
import { usePickExerciseTargetPageLogic } from '@/features/home/ui/pages/PickExerciseTargetPage/PickExerciseTargetPage.logic';

/**
 * The exercise library picker, as a form sheet, adding to the list the route names. Each target
 * is its own component because each calls different hooks; choosing between them by param keeps
 * every hook call unconditional.
 */
export function PickExerciseTargetPage() {
  const { state } = usePickExerciseTargetPageLogic();
  if (state.routineId !== null) return <PickIntoRoutine routineId={state.routineId} />;
  if (state.intoSession) return <PickIntoSession />;
  return <PickIntoDraft />;
}
