import { RoutinePage } from '@/features/routines/pages';
import { useWorkoutLauncher } from '@/workout/startWorkout';

/** The routine page, with the way into a workout it cannot build itself (the workouts are a peer). */
export default function RoutineRoute() {
  return <RoutinePage launcher={useWorkoutLauncher()} />;
}
