import { Effect } from 'effect';
import { SessionRepository } from '@/features/workouts/domain/repositories/SessionRepository';

/**
 * The workout to restore at launch, or `null`. Only an active or paused session comes back: one
 * already recorded or discarded never does.
 */
export const hydrateSession = Effect.flatMap(SessionRepository, repository => repository.active).pipe(
  Effect.map(session => session ?? null),
);
