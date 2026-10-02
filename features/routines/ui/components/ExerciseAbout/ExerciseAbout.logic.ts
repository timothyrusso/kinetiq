import { useMemo } from 'react';
import { useT } from '@/features/core/translations';
import { exerciseImageSource, useExercise } from '@/features/exercises';

/**
 * What the library says about the exercise, read through `useExercise` rather than the snapshot
 * alone: the catalog row has the steps and the start frame a stored copy may lack. The image is
 * the bundled start frame the stored path names, resolved here, and never animated: the editor
 * is for adjusting targets, the detail for watching the movement. A missing description is said,
 * not hidden.
 */
export function useExerciseAboutLogic(exerciseId: string) {
  const { t } = useT();
  const detail = useExercise(exerciseId);
  const exercise = detail.exercise;
  const steps = useMemo(() => {
    const trimmed = (exercise?.instructions ?? []).map(step => step.trim()).filter(step => step.length > 0);
    return trimmed.length === 0 ? null : trimmed;
  }, [exercise]);
  return {
    state: { isLoading: detail.isLoading },
    derived: {
      image: exerciseImageSource(exercise?.imageUrl ?? null) ?? exerciseImageSource(exercise?.thumbnailUrl ?? null),
      imageLabel: t('itemEditor.imageA11y', { name: exercise?.name ?? '' }),
      steps,
      fallback: t(detail.isCatalogId ? 'exerciseDetail.noDescription' : 'exerciseDetail.unknownBuiltIn'),
    },
  };
}
