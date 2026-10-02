import { useMemo } from 'react';
import { useT } from '@/features/core/translations';
import { useExercise } from '@/features/exercises/facades/useExercise';
import { exerciseImageSource } from '@/features/exercises/mappers/exerciseImageSource';

/**
 * What the library says about exercise `exerciseId` (nothing to read while it is `null`), as the design system's `ExerciseAbout`
 * draws it: read through `useExercise` rather than a snapshot alone, since the catalog row has the
 * steps and both frames a stored copy may lack. A row with no end frame (a stored copy, a custom
 * exercise) is a still. A missing description is said, not hidden. Whether the photo moves and
 * where the link goes are the caller's: they belong to the screen it sits on.
 */
export function useExerciseAbout(exerciseId: string | null) {
  const { t } = useT();
  const detail = useExercise(exerciseId);
  const { exercise, isLoading, isCatalogId } = detail;
  return useMemo(() => {
    const trimmed = (exercise?.instructions ?? []).map(step => step.trim()).filter(step => step.length > 0);
    const image =
      exerciseImageSource(exercise?.imageUrl ?? null) ?? exerciseImageSource(exercise?.thumbnailUrl ?? null);
    const name = exercise?.name ?? '';
    return {
      isLoading,
      image,
      imageEnd: image === null ? null : exerciseImageSource(exercise?.imageEndUrl ?? null),
      imageLabel: t('itemEditor.imageA11y', { name }),
      openLabel: t('exerciseDetail.openA11y', { name }),
      steps: trimmed.length === 0 ? null : trimmed,
      fallback: t(isCatalogId ? 'exerciseDetail.noDescription' : 'exerciseDetail.unknownBuiltIn'),
    };
  }, [exercise, isCatalogId, isLoading, t]);
}
