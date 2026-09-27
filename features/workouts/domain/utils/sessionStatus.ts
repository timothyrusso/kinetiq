import type { WorkoutSession } from '@/features/workouts/domain/schemas/WorkoutSessionSchema';

/** Active or paused: the workout is in progress, and a second one must not start over it. */
export function isInProgress(session: WorkoutSession | null): session is WorkoutSession {
  return session !== null && (session.status === 'active' || session.status === 'paused');
}
