import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useMemo } from 'react';
import { Platform } from 'react-native';
import type { Tag } from '@/features/core/design-system';
import { useScreenContentBottom, useTransparentHeaderInset } from '@/features/core/design-system';
import { routes } from '@/features/core/navigation';
import { spacing } from '@/features/core/theme';
import { useT } from '@/features/core/translations';
import type { Exercise } from '@/features/exercises/domain/schemas/ExerciseSchema';
import { provisionalExerciseName } from '@/features/exercises/domain/utils/exerciseId';
import { useExercise } from '@/features/exercises/facades/useExercise';
import { useExerciseVariations } from '@/features/exercises/facades/useExerciseVariations';
import { useOpenExternalPage } from '@/features/exercises/facades/useOpenExternalPage';

const NO_VARIATIONS: readonly Exercise[] = [];

/**
 * wger's web app serves an exercise at `/exercise/<base id>/view`, no trailing slash: the route is
 * spelled that way in wger's own `exercises/urls.py`, and the bare `/exercise/<id>/` answers 404.
 */
function wgerPageUrl(exercise: Exercise | null): string | null {
  if (exercise?.externalId === null || exercise?.externalId === undefined) return null;
  return `https://wger.de/en/exercise/${exercise.externalId}/view`;
}

/**
 * The exercise detail screen: what the library says about one movement, where that answer came
 * from, and the ways on (its variations, its page on wger). The history the user has with it is
 * its own component.
 */
export function useExerciseDetailPageLogic() {
  const { t } = useT();
  const { id } = useLocalSearchParams<{ id: string }>();
  const bottom = useScreenContentBottom();
  const transparentInset = useTransparentHeaderInset();

  const exerciseId = typeof id === 'string' && id.length > 0 ? id : null;
  const detail = useExercise(exerciseId);
  const exercise = detail.exercise;
  const variations = useExerciseVariations(exercise);

  // NOTE: an exercise that cannot be resolved has nothing to show, so its one way on is back.
  const goBack = useCallback(() => {
    if (router.canGoBack()) router.back();
    else router.replace(routes.home());
  }, []);

  const primaryTags = useMemo<Tag[]>(
    () => (exercise?.primaryMuscles ?? []).map(name => ({ key: `p:${name}`, label: name, tone: 'accent' })),
    [exercise],
  );
  const secondaryTags = useMemo<Tag[]>(
    () => (exercise?.secondaryMuscles ?? []).map(name => ({ key: `s:${name}`, label: name })),
    [exercise],
  );
  const equipmentTags = useMemo<Tag[]>(
    () => (exercise?.equipment ?? []).map(name => ({ key: `e:${name}`, label: name })),
    [exercise],
  );

  const externalUrl = useMemo(() => wgerPageUrl(exercise), [exercise]);
  const openPage = useOpenExternalPage();
  const openExternal = useCallback(() => {
    if (externalUrl !== null) openPage(externalUrl);
  }, [externalUrl, openPage]);

  const currentId = exercise?.id ?? null;
  const openVariation = useCallback(
    (variationId: string) => {
      if (variationId === currentId) return;
      router.push(routes.exerciseDetail(variationId));
    },
    [currentId],
  );

  // NOTE: iOS only. The bar floats over the art because the system blurs what scrolls under it;
  // Android's top app bar has no blur, so a transparent one let the text scroll under the title
  // and the status bar. There it stays the opaque surface every other screen has.
  const transparent = Platform.OS === 'ios' && exercise?.imageUrl != null;
  const topInset = transparent ? transparentInset : 0;
  const contentStyle = useMemo(() => ({ paddingBottom: bottom }), [bottom]);
  const statusStyle = useMemo(() => ({ paddingTop: topInset + spacing.xl }), [topInset]);

  const title =
    exercise?.name ?? (exerciseId === null ? t('exerciseDetail.fallbackTitle') : provisionalExerciseName(exerciseId));
  const instructions =
    exercise?.instructions === null || exercise?.instructions === undefined || exercise.instructions.length === 0
      ? null
      : exercise.instructions;

  return {
    state: {
      exercise,
      from: detail.from,
      fetchable: detail.fetchable,
      isLoading: detail.isLoading,
      isFetching: detail.isFetching,
      error: detail.error,
      storedAt: detail.stored?.capturedAt ?? null,
      exerciseId,
      variations: variations.data ?? NO_VARIATIONS,
    },
    derived: {
      title,
      transparent,
      topInset,
      contentStyle,
      statusStyle,
      primaryTags,
      secondaryTags,
      equipmentTags,
      instructions,
      hasExternalPage: externalUrl !== null,
    },
    effects: { retry: detail.retry, goBack, openVariation, openExternal },
  };
}
