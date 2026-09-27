import { Context, type Effect } from 'effect';
import type { SqlError } from '@/features/core/error';

/**
 * Counts a recorded workout against the routine it came from. A port: `workouts` never imports
 * `routines`, so the composition root provides it over the routines' own repository. A routine
 * deleted since the workout started matches nothing and changes nothing.
 */
export class RoutineUsage extends Context.Tag('workouts/RoutineUsage')<
  RoutineUsage,
  {
    readonly markUsed: (routineId: string, performedAt: number) => Effect.Effect<void, SqlError>;
  }
>() {}
