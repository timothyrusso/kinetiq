import { Effect } from 'effect';
import { SessionRepository } from '@/features/workouts/domain/repositories/SessionRepository';
import type { ActivityId } from '@/features/workouts/domain/schemas/ActivityId';

/**
 * Throws session `id` away without recording it. The row is deleted outright rather than flagged,
 * so a crash afterwards cannot leave a half-workout to restore.
 */
export const discardSession = (id: ActivityId) =>
  Effect.flatMap(SessionRepository, repository => repository.remove(id));
