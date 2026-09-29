import { Effect, Layer } from 'effect';
import { ExercisesLive } from '@/features/exercises';
import { WorkoutsLive } from '@/features/workouts/di/layer';
import type { RoutineUpdate } from '@/features/workouts/domain/entities/RoutineUpdate';
import { RoutineUsage } from '@/features/workouts/domain/services/RoutineUsage';

/** The routines each recorded workout was counted against, in order. */
export const routinesUsed: string[] = [];

/** What each finish with its switch on asked to write back into its routine, in order. */
export const routinesUpdated: RoutineUpdate[] = [];

/**
 * The workouts with the exercises they store snapshots in, both real, on `makeTestRuntime`'s
 * migrated in-memory database; the routines' port records what it was asked to count and to write back.
 */
export const WorkoutsTestLayer = WorkoutsLive.pipe(
  Layer.provideMerge(
    Layer.mergeAll(
      ExercisesLive,
      Layer.succeed(RoutineUsage, {
        markUsed: routineId => Effect.sync(() => void routinesUsed.push(routineId)),
        applyWorkout: update => Effect.sync(() => void routinesUpdated.push(update)),
      }),
    ),
  ),
);
