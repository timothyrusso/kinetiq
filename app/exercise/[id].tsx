import { ExerciseDetailPage } from '@/features/exercises/pages';
import { ExerciseHistorySection } from '@/features/workouts/pages';

/** The history section is the workouts' own, handed to the exercise page, which cannot import it. */
const renderHistory = (exerciseId: string | null) => <ExerciseHistorySection exerciseId={exerciseId} />;

export default function ExerciseDetailRoute() {
  return <ExerciseDetailPage renderHistory={renderHistory} />;
}
