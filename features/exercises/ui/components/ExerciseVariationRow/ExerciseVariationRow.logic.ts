import { useCallback, useMemo } from 'react';
import type { Tag } from '@/features/core/design-system';
import { useT } from '@/features/core/translations';
import type { Exercise } from '@/features/exercises/domain/schemas/ExerciseSchema';

/** A variation's one tag (its category, or "this exercise" for the one on screen) and its press. */
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
  const open = useCallback(() => onOpen(exercise.id), [exercise.id, onOpen]);
  return { derived: { tags, uri: exercise.thumbnailUrl ?? exercise.imageUrl }, effects: { open } };
}
