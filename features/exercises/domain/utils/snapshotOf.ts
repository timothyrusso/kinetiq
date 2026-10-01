import type { Exercise } from '@/features/exercises/domain/schemas/ExerciseSchema';
import type { ExerciseSnapshot } from '@/features/exercises/domain/schemas/ExerciseSnapshotSchema';

/**
 * The storable copy of `exercise`, captured at `capturedAt`. A list row with only full-size art
 * still needs something, so the thumbnail falls back to the image. The images stay the asset
 * paths the catalog reads, so the copy resolves to the bundled files in any later build.
 */
export function snapshotOf(exercise: Exercise, capturedAt: number): ExerciseSnapshot {
  return {
    exerciseId: exercise.id,
    name: exercise.name,
    instructions: exercise.instructions,
    category: exercise.category,
    primaryMuscles: exercise.primaryMuscles,
    secondaryMuscles: exercise.secondaryMuscles,
    equipment: exercise.equipment,
    imageUrl: exercise.imageUrl,
    thumbnailUrl: exercise.thumbnailUrl ?? exercise.imageUrl,
    capturedAt,
  };
}
