import { Effect, Layer } from 'effect';
import { BackgroundSync } from '@/features/core/lifecycle';
import { ExercisesLive } from '@/features/exercises';
import { RoutineRepository, RoutinesLive } from '@/features/routines';
import { RoutineUsage, WorkoutsLive } from '@/features/workouts';

/** What the watch mirror was asked to do: every push and every two-way sync, in order. */
export const mirrorCalls: string[] = [];

/** The watch mirror, recording instead of talking to a watch. */
const BackgroundSyncFake = Layer.succeed(BackgroundSync, {
  install: Effect.sync(() => void mirrorCalls.push('install')),
  sync: Effect.sync(() => void mirrorCalls.push('sync')),
  push: Effect.sync(() => void mirrorCalls.push('push')),
});

/**
 * The workouts, the routines and the exercises, all real, on `makeTestRuntime`'s migrated
 * in-memory database, with the watch mirror recorded and a routine count that is never asked
 * for: what a profile ViewModel test runs over.
 */
export const ProfileTestLayer = WorkoutsLive.pipe(
  Layer.provideMerge(
    Layer.mergeAll(
      RoutinesLive.pipe(Layer.provideMerge(ExercisesLive)),
      Layer.succeed(RoutineUsage, { markUsed: () => Effect.void }),
      BackgroundSyncFake,
    ),
  ),
);

/** Stores an empty push day. */
export const saveRoutine = Effect.flatMap(RoutineRepository, repository =>
  repository.save({ name: 'Push Day', items: [] }),
);

/** Every stored routine. */
export const storedRoutines = Effect.flatMap(RoutineRepository, repository => repository.list);
