import { Context, type Effect } from 'effect';
import type { DecodeError, SqlError } from '@/features/core/error';
import type { DuplicateWorkout } from '@/features/workouts/domain/errors/WorkoutsErrors';
import type { Activity } from '@/features/workouts/domain/schemas/ActivitySchema';
import type { CompletedWorkout } from '@/features/workouts/domain/schemas/CompletedWorkoutSchema';

/**
 * Writes a workout finished somewhere else (the Apple Watch) to history, by the same rules as a
 * phone session: records, the routine's count, all or nothing, and `DuplicateWorkout` for a
 * workout already in history.
 */
export class WorkoutRecorder extends Context.Tag('workouts/WorkoutRecorder')<
  WorkoutRecorder,
  {
    readonly record: (workout: CompletedWorkout) => Effect.Effect<Activity, DuplicateWorkout | SqlError | DecodeError>;
  }
>() {}
