import { router, useIsFocused } from 'expo-router';
import { useCallback, useMemo } from 'react';
import { routes } from '@/features/core/navigation';
import { useT } from '@/features/core/translations';
import { exerciseImageSource, useExercise } from '@/features/exercises';

/**
 * What the library says about the exercise, read through `useExercise` rather than the snapshot
 * alone: the catalog row has the steps and both frames a stored copy may lack. The photo
 * cross-fades between the start and end frames like the detail hero, while this sheet is the
 * focused screen; a row with no end frame (a stored copy, a custom exercise) stays a still. The
 * photo and the title open the exercise page, pushed over the sheet, so back returns to it. A
 * missing description is said, not hidden.
 */
export function useExerciseAboutLogic(exerciseId: string) {
  const { t } = useT();
  const detail = useExercise(exerciseId);
  const exercise = detail.exercise;
  const focused = useIsFocused();
  const steps = useMemo(() => {
    const trimmed = (exercise?.instructions ?? []).map(step => step.trim()).filter(step => step.length > 0);
    return trimmed.length === 0 ? null : trimmed;
  }, [exercise]);
  const start = exerciseImageSource(exercise?.imageUrl ?? null) ?? exerciseImageSource(exercise?.thumbnailUrl ?? null);
  const end = start === null ? null : exerciseImageSource(exercise?.imageEndUrl ?? null);
  const open = useCallback(() => router.push(routes.exerciseDetail(exerciseId, true)), [exerciseId]);
  const name = exercise?.name ?? '';
  return {
    state: { isLoading: detail.isLoading, animating: focused },
    derived: {
      image: start,
      imageEnd: end,
      imageLabel: t('itemEditor.imageA11y', { name }),
      openLabel: t('exerciseDetail.openA11y', { name }),
      steps,
      fallback: t(detail.isCatalogId ? 'exerciseDetail.noDescription' : 'exerciseDetail.unknownBuiltIn'),
    },
    effects: { open },
  };
}
