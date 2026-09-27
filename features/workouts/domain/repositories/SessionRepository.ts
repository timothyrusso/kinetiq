import { Context, type Effect } from 'effect';
import type { DecodeError, SqlError } from '@/features/core/error';
import type { ActivityId } from '@/features/workouts/domain/schemas/ActivityId';
import type { WorkoutSession, WorkoutSessionStatus } from '@/features/workouts/domain/schemas/WorkoutSessionSchema';

/** A read of the sessions table: a statement failed, or a row is not the shape it should be. */
type SessionReadError = SqlError | DecodeError;

/**
 * The workout in progress, in the `sessions` table. Every change the user makes lands here, so a
 * force-quit loses at most the last change; the rest is stored as its absolute deadline.
 */
export class SessionRepository extends Context.Tag('workouts/SessionRepository')<
  SessionRepository,
  {
    /** Writes the whole session, inserting it or replacing the stored row. */
    readonly save: (session: WorkoutSession) => Effect.Effect<void, SqlError>;
    readonly byId: (id: ActivityId) => Effect.Effect<WorkoutSession | undefined, SessionReadError>;
    /**
     * The most recently changed session that is `active` or `paused`. A finished or discarded row
     * is never offered: that is the difference between a restore and a workout that keeps coming
     * back.
     */
    readonly active: Effect.Effect<WorkoutSession | undefined, SessionReadError>;
    /** Clears the rest deadline and its length, touching only those columns. */
    readonly clearRest: (id: ActivityId) => Effect.Effect<void, SqlError>;
    readonly setStatus: (id: ActivityId, status: WorkoutSessionStatus) => Effect.Effect<void, SqlError>;
    /** Deletes the row, so a crash afterwards has nothing half-done to restore. */
    readonly remove: (id: ActivityId) => Effect.Effect<void, SqlError>;
  }
>() {}
