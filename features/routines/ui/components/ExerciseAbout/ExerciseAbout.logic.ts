import { useT } from '@/features/core/translations';
import { useExercise } from '@/features/exercises';

/**
 * What the library says about the exercise, read through `useExercise` rather than the snapshot
 * alone: a snapshot captured from a search row often has no description and only a thumbnail,
 * and the catalog (or the stored copy) fills both in. A missing description is said, not hidden.
 */
export function useExerciseAboutLogic(exerciseId: string) {
  const { t } = useT();
  const detail = useExercise(exerciseId);
  const exercise = detail.exercise;
  const instructions = exercise?.instructions?.trim() || null;
  return {
    state: { isLoading: detail.isLoading },
    derived: {
      image: exercise?.imageUrl ?? exercise?.thumbnailUrl ?? null,
      imageLabel: t('itemEditor.imageA11y', { name: exercise?.name ?? '' }),
      description:
        instructions ?? t(detail.fetchable ? 'exerciseDetail.noDescription' : 'exerciseDetail.unknownBuiltIn'),
      described: instructions !== null,
    },
  };
}
