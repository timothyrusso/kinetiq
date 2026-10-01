import { useCallback, useMemo } from 'react';
import type { Tag } from '@/features/core/design-system';
import { useT } from '@/features/core/translations';
import type { Exercise } from '@/features/exercises/domain/schemas/ExerciseSchema';
import { exerciseImageSource } from '@/features/exercises/mappers/exerciseImageSource';

/**
 * A similar exercise's one tag (its body area, or "this exercise" for the one on screen), its
 * bundled thumbnail and its press.
 */
export function useExerciseVariationRowLogic(exercise: Exercise, current: boolean, onOpen: (id: string) => void) {
  const { t } = useT();
  const tags = useMemo<Tag[]>(
    () => [
      {
        key: 'kind',
        label: current ? t('exerciseDetail.thisExercise') : (exercise.category ?? t('exerciseDetail.variation')),
      },
    ],
    [current, exercise.category, t],
  );
  const image = useMemo(
    () => exerciseImageSource(exercise.thumbnailUrl) ?? exerciseImageSource(exercise.imageUrl),
    [exercise.imageUrl, exercise.thumbnailUrl],
  );
  const open = useCallback(() => onOpen(exercise.id), [exercise.id, onOpen]);
  return { derived: { tags, image }, effects: { open } };
}
