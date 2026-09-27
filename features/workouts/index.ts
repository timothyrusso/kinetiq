import type { FeatureTier } from '@timothyrusso/arch-rules';

/**
 * @public Read by the architecture rules, which build the tier graph from it. Tier 3: a workout
 * is built from exercises (tier 2). It never imports `routines`, its peer: a routine becomes a
 * `SessionPlan` in the tier-4 code that starts it, and the routine's trained count goes through
 * the `RoutineUsage` port.
 */
export const FEATURE_TIER: FeatureTier = 3;

export { WorkoutsLive } from '@/features/workouts/di/layer';
export type { TrainingHeatmap } from '@/features/workouts/domain/entities/TrainingSummary';
/** A workout already in history: what recording one twice fails with. */
export { DuplicateWorkout } from '@/features/workouts/domain/errors/WorkoutsErrors';
/** The history, for the export. */
export { ActivityRepository } from '@/features/workouts/domain/repositories/ActivityRepository';
/** The workout in progress on disk, which the launch restores. */
export { SessionRepository } from '@/features/workouts/domain/repositories/SessionRepository';
export { ActivityId } from '@/features/workouts/domain/schemas/ActivityId';
export type { Activity } from '@/features/workouts/domain/schemas/ActivitySchema';
export type { CompletedWorkout } from '@/features/workouts/domain/schemas/CompletedWorkoutSchema';
export type { SessionPlan } from '@/features/workouts/domain/schemas/SessionPlanSchema';
export type { StrengthEntry } from '@/features/workouts/domain/schemas/StrengthEntrySchema';
/** The port the tier-4 home fills over the routines. */
export { RoutineUsage } from '@/features/workouts/domain/services/RoutineUsage';
/** How a workout from the Apple Watch goes into history. */
export { WorkoutRecorder } from '@/features/workouts/domain/services/WorkoutRecorder';
/** The derivations a watch workout is recorded with, the same as a phone session's. */
export {
  completedSetCount,
  estimateCalories,
  estimatedOneRepMax,
  totalVolumeKg,
} from '@/features/workouts/domain/utils/workoutMath';
export {
  sessionLifecycle,
  useActiveSession,
  useRunningWorkoutName,
  useWorkoutRunning,
} from '@/features/workouts/facades/useActiveSession';
export { useActivities, useDeleteActivity } from '@/features/workouts/facades/useActivities';
export { useAddSessionExercise } from '@/features/workouts/facades/useAddSessionExercise';
export { useTrainingHeatmap, useTrainingSummary } from '@/features/workouts/facades/useProgress';
export { useStartSession } from '@/features/workouts/facades/useStartSession';
export { invalidateAfterWatchWorkouts } from '@/features/workouts/facades/workoutQueryKeys';
