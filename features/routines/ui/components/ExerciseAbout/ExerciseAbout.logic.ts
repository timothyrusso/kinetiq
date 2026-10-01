import { useT } from '@/features/core/translations';
import { exerciseImageSource, useExercise } from '@/features/exercises';

/**
 * What the library says about the exercise, read through `useExercise` rather than the snapshot
 * alone: the catalog row has the steps and the start frame a stored copy may lack. The image is
 * the bundled file the stored path names, resolved here. A missing description is said, not
 * hidden.
 */
export function useExerciseAboutLogic(exerciseId: string) {
  const { t } = useT();
  const detail = useExercise(exerciseId);
  const exercise = detail.exercise;
  const steps = (exercise?.instructions ?? []).map(step => step.trim()).filter(step => step.length > 0);
  const instructions = steps.length === 0 ? null : steps.join('\n\n');
  return {
    state: { isLoading: detail.isLoading },
    derived: {
      image: exerciseImageSource(exercise?.imageUrl ?? null) ?? exerciseImageSource(exercise?.thumbnailUrl ?? null),
      imageLabel: t('itemEditor.imageA11y', { name: exercise?.name ?? '' }),
      description:
        instructions ?? t(detail.isCatalogId ? 'exerciseDetail.noDescription' : 'exerciseDetail.unknownBuiltIn'),
      described: instructions !== null,
    },
  };
}
