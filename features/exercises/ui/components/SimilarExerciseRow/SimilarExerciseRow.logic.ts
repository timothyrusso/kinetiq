import { useCallback, useMemo } from 'react';
import type { Tag } from '@/features/core/design-system';
import type { Exercise } from '@/features/exercises/domain/schemas/ExerciseSchema';
import { exerciseImageSource } from '@/features/exercises/mappers/exerciseImageSource';

const NO_TAGS: Tag[] = [];

/** A similar exercise's one tag (its body area), its bundled start-frame thumbnail and its press. */
export function useSimilarExerciseRowLogic(exercise: Exercise, onOpen: (id: string) => void) {
  const tags = useMemo<Tag[]>(
    () => (exercise.category === null ? NO_TAGS : [{ key: 'area', label: exercise.category }]),
    [exercise.category],
  );
  const image = useMemo(
    () => exerciseImageSource(exercise.thumbnailUrl) ?? exerciseImageSource(exercise.imageUrl),
    [exercise.imageUrl, exercise.thumbnailUrl],
  );
  const open = useCallback(() => onOpen(exercise.id), [exercise.id, onOpen]);
  return { derived: { tags, image }, effects: { open } };
}
