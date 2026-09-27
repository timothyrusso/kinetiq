import { Effect } from 'effect';
import type { SessionWrite } from '@/features/workouts/domain/entities/SessionWrite';
import { SessionPersistFailed } from '@/features/workouts/domain/errors/WorkoutsErrors';
import { SessionRepository } from '@/features/workouts/domain/repositories/SessionRepository';

/** Makes one change of the workout in progress durable. A failed write is `SessionPersistFailed`. */
export const persistSession = (write: SessionWrite) =>
  Effect.gen(function* () {
    const repository = yield* SessionRepository;
    if (write.kind === 'save') yield* repository.save(write.session);
    else yield* repository.clearRest(write.sessionId);
  }).pipe(
    Effect.mapError(
      cause =>
        new SessionPersistFailed({
          sessionId: write.kind === 'save' ? write.session.id : write.sessionId,
          cause,
        }),
    ),
  );
