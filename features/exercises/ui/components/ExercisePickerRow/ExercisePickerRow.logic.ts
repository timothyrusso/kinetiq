import { useCallback, useMemo } from 'react';
import { exerciseTags } from '@/features/core/design-system';
import type { Exercise } from '@/features/exercises/domain/schemas/ExerciseSchema';
import { exerciseImageSource } from '@/features/exercises/mappers/exerciseImageSource';

/**
 * A result's taxonomy tags and bundled thumbnail, built once per exercise, and its press, which
 * hands back its id.
 */
export function useExercisePickerRowLogic(exercise: Exercise, onSelect: (exerciseId: string) => void) {
  const tags = useMemo(() => exerciseTags(exercise), [exercise]);
  const image = useMemo(
    () => exerciseImageSource(exercise.thumbnailUrl) ?? exerciseImageSource(exercise.imageUrl),
    [exercise.imageUrl, exercise.thumbnailUrl],
  );
  const select = useCallback(() => onSelect(exercise.id), [exercise.id, onSelect]);
  return { derived: { tags, image }, effects: { select } };
}
