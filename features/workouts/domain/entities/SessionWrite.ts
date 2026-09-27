import type { ActivityId } from '@/features/workouts/domain/schemas/ActivityId';
import type { WorkoutSession } from '@/features/workouts/domain/schemas/WorkoutSessionSchema';

/**
 * One change of the workout in progress, as it goes to disk: the whole session, or, for a rest
 * the user skipped, only its deadline cleared.
 */
export type SessionWrite =
  | { readonly kind: 'save'; readonly session: WorkoutSession }
  | { readonly kind: 'clearRest'; readonly sessionId: ActivityId };
