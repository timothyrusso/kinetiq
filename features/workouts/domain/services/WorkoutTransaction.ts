import { Context, type Effect } from 'effect';
import type { SqlError } from '@/features/core/error';

/**
 * Runs several repository calls as one all-or-nothing write: `effect` commits when it succeeds
 * and rolls back when it fails, on the connection every repository uses.
 */
export class WorkoutTransaction extends Context.Tag('workouts/WorkoutTransaction')<
  WorkoutTransaction,
  {
    readonly atomically: <A, E, R>(effect: Effect.Effect<A, E, R>) => Effect.Effect<A, E | SqlError, R>;
  }
>() {}
