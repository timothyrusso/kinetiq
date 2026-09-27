import type { Exercise } from '@/features/exercises/domain/schemas/ExerciseSchema';
import type { ExerciseSnapshot } from '@/features/exercises/domain/schemas/ExerciseSnapshotSchema';

/**
 * A snapshot as an `Exercise`. A snapshot never carries a video URL (storing one was never needed
 * to render a routine), so `videoUrl` is null, which is true, and the media section is absent
 * rather than a dead link.
 */
export function exerciseFromSnapshot(snapshot: ExerciseSnapshot): Exercise {
  return {
    id: snapshot.exerciseId,
    name: snapshot.name,
    instructions: snapshot.instructions,
    category: snapshot.category,
    primaryMuscles: snapshot.primaryMuscles,
    secondaryMuscles: snapshot.secondaryMuscles,
    equipment: snapshot.equipment,
    imageUrl: snapshot.imageUrl,
    thumbnailUrl: snapshot.thumbnailUrl,
    videoUrl: null,
    source: snapshot.externalId === null ? 'local' : 'remote',
    externalId: snapshot.externalId,
  };
}
