import type { Routine } from '@/features/routines/domain/schemas/RoutineSchema';

/**
 * What the routine screen needs from the workouts, which it may not import (they are peers): the
 * name of the workout in progress, if any, and a way to start one from a routine. The tier-4 code
 * that knows both provides it.
 */
export interface WorkoutLauncher {
  /** The workout in progress (active or paused), or `null`. */
  readonly running: { readonly name: string } | null;
  readonly starting: boolean;
  /**
   * Starts a workout from `routine` and reports whether one started: `false` for a routine with
   * no exercises, which must not open an empty workout.
   */
  readonly start: (routine: Routine, onResult: (started: boolean) => void) => void;
}
