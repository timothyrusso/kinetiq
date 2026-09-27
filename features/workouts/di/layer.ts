import { Layer } from 'effect';
import { ActivityRepositoryLive } from '@/features/workouts/data/repositories/activityRepositoryLive';
import { RecordRepositoryLive } from '@/features/workouts/data/repositories/recordRepositoryLive';
import { SessionRepositoryLive } from '@/features/workouts/data/repositories/sessionRepositoryLive';
import { SessionEngineLive } from '@/features/workouts/data/services/sessionEngineLive';
import { WorkoutTransactionLive } from '@/features/workouts/data/services/workoutTransactionLive';
import { WorkoutRecorderLive } from '@/features/workouts/di/workoutRecorderLive';

/** The three repositories and the transaction they share. */
const StorageLive = Layer.mergeAll(
  ActivityRepositoryLive,
  RecordRepositoryLive,
  WorkoutTransactionLive,
  SessionRepositoryLive,
);

/**
 * Every Layer `workouts` provides: the three repositories, the transaction they share, the engine
 * that persists the session store and runs its clock, and the recorder the watch sync writes
 * through. `RoutineUsage` is left open: the tier-4 home provides it over the routines.
 */
export const WorkoutsLive = Layer.mergeAll(
  WorkoutRecorderLive,
  SessionEngineLive.pipe(Layer.provide(SessionRepositoryLive)),
).pipe(Layer.provideMerge(StorageLive));
