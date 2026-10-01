import type { Exercise } from '@/features/exercises/domain/schemas/ExerciseSchema';
import type { ExerciseSnapshot } from '@/features/exercises/domain/schemas/ExerciseSnapshotSchema';
import { isLocalExerciseId } from '@/features/exercises/domain/utils/exerciseId';

/**
 * A snapshot as an `Exercise`. A snapshot keeps what a routine row and the detail screen need,
 * not the dataset's keys or the end frame, so those are null: true of the copy, and the screen
 * leaves out what they would draw.
 */
export function exerciseFromSnapshot(snapshot: ExerciseSnapshot): Exercise {
  return {
    id: snapshot.exerciseId,
    name: snapshot.name,
    instructions: snapshot.instructions,
    category: snapshot.category,
    bodyArea: null,
    trainingType: null,
    level: null,
    force: null,
    mechanic: null,
    primaryMuscles: snapshot.primaryMuscles,
    secondaryMuscles: snapshot.secondaryMuscles,
    equipment: snapshot.equipment,
    imageUrl: snapshot.imageUrl,
    imageEndUrl: null,
    thumbnailUrl: snapshot.thumbnailUrl,
    source: isLocalExerciseId(snapshot.exerciseId) ? 'local' : 'catalog',
  };
}
