import type { Exercise } from '@/features/exercises/domain/schemas/ExerciseSchema';
import type { TrackingType } from '@/features/exercises/domain/schemas/TrackingType';

/**
 * The tracking type a newly added exercise starts with, from the catalog's keys. The order
 * matters: a cardio or stretching exercise is timed even when it needs no equipment, and a static
 * hold such as the plank is timed although it is bodyweight strength. An exercise read from a
 * snapshot has none of these keys and starts as `weightReps`.
 */
export function defaultTrackingType(
  exercise: Pick<Exercise, 'trainingType' | 'force' | 'equipmentKeys'>,
): TrackingType {
  if (exercise.trainingType === 'cardio' || exercise.trainingType === 'stretching') return 'duration';
  if (exercise.trainingType === 'strength' && exercise.force === 'static') return 'duration';
  if (exercise.equipmentKeys.includes('body-only')) return 'repsOnly';
  return 'weightReps';
}
