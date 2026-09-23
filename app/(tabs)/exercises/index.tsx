/**
 * Exercises tab: the library at the root of its own stack, on the app-wide tab filter. The
 * screen itself lives in `src/ui/exerciseLibrary.tsx`, because an exercise's detail pushes
 * the same list with a filter of its own.
 */
import { tabExerciseFilter } from '@/queries/exerciseFilters';
import { ExerciseLibrary } from '@/ui/exerciseLibrary';

export default function ExercisesScreen() {
  return <ExerciseLibrary store={tabExerciseFilter} inTab />;
}
