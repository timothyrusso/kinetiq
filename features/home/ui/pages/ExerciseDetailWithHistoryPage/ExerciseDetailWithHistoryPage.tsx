import { ExerciseDetailPage } from '@/features/exercises/pages';
import { ExerciseHistorySection } from '@/features/workouts/pages';

/** The history section is the workouts' own, handed to the exercise page, which cannot import it. */
const renderHistory = (exerciseId: string | null) => <ExerciseHistorySection exerciseId={exerciseId} />;

/** An exercise from the catalog, with the user's own history of it. */
export function ExerciseDetailWithHistoryPage() {
  return <ExerciseDetailPage renderHistory={renderHistory} />;
}
