import { Effect, Layer } from 'effect';
import type { ActivityRepository } from '@/features/workouts/domain/repositories/ActivityRepository';
import type { RecordRepository } from '@/features/workouts/domain/repositories/RecordRepository';
import type { RoutineUsage } from '@/features/workouts/domain/services/RoutineUsage';
import { WorkoutRecorder } from '@/features/workouts/domain/services/WorkoutRecorder';
import type { WorkoutTransaction } from '@/features/workouts/domain/services/WorkoutTransaction';
import { commitWorkout } from '@/features/workouts/useCases/commitWorkout';

type CommitServices = WorkoutTransaction | ActivityRepository | RecordRepository | RoutineUsage;

/** `WorkoutRecorder` over this feature's own `commitWorkout`. */
export const WorkoutRecorderLive = Layer.effect(
  WorkoutRecorder,
  Effect.map(Effect.context<CommitServices>(), services => ({
    record: workout =>
      commitWorkout(workout).pipe(
        Effect.map(result => result.activity),
        Effect.provide(services),
      ),
  })),
);
