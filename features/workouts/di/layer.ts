import { Layer } from 'effect';
import { ActivityRepositoryLive } from '@/features/workouts/data/repositories/activityRepositoryLive';
import { RecordRepositoryLive } from '@/features/workouts/data/repositories/recordRepositoryLive';
import { SessionRepositoryLive } from '@/features/workouts/data/repositories/sessionRepositoryLive';
import { SessionEngineLive } from '@/features/workouts/data/services/sessionEngineLive';
import { WorkoutTransactionLive } from '@/features/workouts/data/services/workoutTransactionLive';

/**
 * Every Layer `workouts` provides: the three repositories, the transaction they share, and the
 * engine that persists the session store and runs its clock. `RoutineUsage` is left open: the
 * composition root provides it over the routines.
 */
export const WorkoutsLive = Layer.mergeAll(
  ActivityRepositoryLive,
  RecordRepositoryLive,
  WorkoutTransactionLive,
  SessionRepositoryLive,
  SessionEngineLive.pipe(Layer.provide(SessionRepositoryLive)),
);
