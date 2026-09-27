/**
 * The imperative workout calls the legacy callers (bootstrap, the watch inbox, the export) still
 * make, run through the app runtime over the `workouts` feature. Goes away when those callers
 * move into features: bootstrap, watch-sync and transfer (#54).
 */
import { Effect } from 'effect';
import { runtime } from '@/features/core/runtime';
import {
  type Activity,
  ActivityRepository,
  type AppLifecycle,
  type CompletedWorkout,
  commitWorkout,
  hydrateSession,
  invalidateAfterWatchWorkouts,
  sessionLifecycle,
  type WorkoutSession,
} from '@/features/workouts';

/**
 * Restores the workout that was open when the process died, and returns it. A read that fails
 * restores nothing, as before: the launch must not stop on it.
 */
export async function hydrateWorkoutSession(): Promise<WorkoutSession | null> {
  const session = await runtime.runPromise(hydrateSession).catch((error: unknown) => {
    console.warn('[workout] could not read active session', error);
    return null;
  });
  sessionLifecycle.restore(session);
  return session;
}

/** Pauses the workout in progress; a restored one comes back paused. */
export function pauseSession(): void {
  sessionLifecycle.pause();
}

/** Follows the app in and out of the foreground. */
export function handleAppState(next: AppLifecycle): void {
  sessionLifecycle.appStateChanged(next);
}

/**
 * Records a finished workout from the watch. Resolves `null` when a workout with its id is already
 * in history; any other failure rejects, so the caller keeps the payload for the next drain.
 */
export function commitCompletedWorkout(workout: CompletedWorkout): Promise<{ activity: Activity } | null> {
  return runtime.runPromise(
    commitWorkout(workout).pipe(Effect.catchTag('DuplicateWorkout', () => Effect.succeed(null))),
  );
}

/** Workouts arrived from the watch: every read that shows them refreshes. */
export { invalidateAfterWatchWorkouts };

/** Every recorded workout, oldest first, for an export. */
export function listAllActivities(): Promise<readonly Activity[]> {
  return runtime.runPromise(Effect.flatMap(ActivityRepository, (repository) => repository.list({ order: 'asc' })));
}
