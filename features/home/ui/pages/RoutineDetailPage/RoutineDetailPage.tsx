import { useRoutineDetailPageLogic } from '@/features/home/ui/pages/RoutineDetailPage/RoutineDetailPage.logic';
import { RoutinePage } from '@/features/routines/pages';

/** A saved routine, with the way into a workout from it. */
export function RoutineDetailPage() {
  const { effects } = useRoutineDetailPageLogic();
  return <RoutinePage launcher={effects.launcher} />;
}
