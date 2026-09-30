import { Context, type Effect } from 'effect';
import type { DecodeError, SqlError } from '@/features/core/error';
import type { RoutineUpdate } from '@/features/workouts/domain/entities/RoutineUpdate';

/**
 * Counts a recorded workout against the routine it came from, and writes a finished workout back
 * into it. A port: `workouts` never imports `routines`, so the composition root provides it over
 * the routines' own repository. A routine deleted since the workout started matches nothing and
 * changes nothing. Both run on the connection the workout's own transaction holds, so they commit
 * or roll back with the workout.
 */
export class RoutineUsage extends Context.Tag('workouts/RoutineUsage')<
  RoutineUsage,
  {
    readonly markUsed: (routineId: string, performedAt: number) => Effect.Effect<void, SqlError>;
    /**
     * Writes today's values into the routine: completed sets, added and removed sets and
     * exercises, and the workout's order. Never rest or notes, never a skipped set or exercise,
     * and never an exercise removed from the routine while the workout ran.
     */
    readonly applyWorkout: (update: RoutineUpdate) => Effect.Effect<void, SqlError | DecodeError>;
  }
>() {}
