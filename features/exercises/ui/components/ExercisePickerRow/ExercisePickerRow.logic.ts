import { useCallback, useMemo } from 'react';
import { exerciseTags } from '@/features/core/design-system';
import type { Exercise } from '@/features/exercises/domain/schemas/ExerciseSchema';

/** A result's taxonomy tags, built once per exercise, and its press, which hands back its id. */
export function useExercisePickerRowLogic(exercise: Exercise, onSelect: (exerciseId: string) => void) {
  const tags = useMemo(() => exerciseTags(exercise), [exercise]);
  const select = useCallback(() => onSelect(exercise.id), [exercise.id, onSelect]);
  return { derived: { tags, uri: exercise.thumbnailUrl ?? exercise.imageUrl }, effects: { select } };
}
