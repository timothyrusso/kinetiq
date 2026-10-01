import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useMemo } from 'react';
import { Platform } from 'react-native';
import type { Tag } from '@/features/core/design-system';
import { useScreenContentBottom, useTransparentHeaderInset } from '@/features/core/design-system';
import { routes } from '@/features/core/navigation';
import { spacing } from '@/features/core/theme';
import { useT } from '@/features/core/translations';
import { BADGE_KEYS } from '@/features/exercises/domain/entities/taxonKeys';
import type { Exercise } from '@/features/exercises/domain/schemas/ExerciseSchema';
import { provisionalExerciseName } from '@/features/exercises/domain/utils/exerciseId';
import { useExercise } from '@/features/exercises/facades/useExercise';
import { useSimilarExercises } from '@/features/exercises/facades/useSimilarExercises';
import { exerciseImageSource } from '@/features/exercises/mappers/exerciseImageSource';

const NO_SIMILAR: readonly Exercise[] = [];

/**
 * The exercise detail screen: what the library says about one movement, where that answer came
 * from, and the way on (the exercises like it). The history the user has with it is its own
 * component.
 */
export function useExerciseDetailPageLogic() {
  const { t } = useT();
  const { id } = useLocalSearchParams<{ id: string }>();
  const bottom = useScreenContentBottom();
  const transparentInset = useTransparentHeaderInset();

  const exerciseId = typeof id === 'string' && id.length > 0 ? id : null;
  const detail = useExercise(exerciseId);
  const exercise = detail.exercise;
  const similar = useSimilarExercises(exercise);

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

  // NOTE: strength is what nearly every exercise is, so only the other training types are worth a
  // badge.
  const badgeTags = useMemo<Tag[]>(() => {
    if (exercise === null) return [];
    const tags: Tag[] = [];
    if (exercise.trainingType !== null && exercise.trainingType !== 'strength') {
      tags.push({ key: 'type', label: t(BADGE_KEYS.trainingType[exercise.trainingType]), tone: 'accent' });
    }
    if (exercise.level !== null) tags.push({ key: 'level', label: t(BADGE_KEYS.level[exercise.level]) });
    if (exercise.mechanic !== null) tags.push({ key: 'mechanic', label: t(BADGE_KEYS.mechanic[exercise.mechanic]) });
    return tags;
  }, [exercise, t]);

  const openSimilar = useCallback((similarId: string) => router.push(routes.exerciseDetail(similarId)), []);

  // NOTE: iOS only. The bar floats over the art because the system blurs what scrolls under it;
  // Android's top app bar has no blur, so a transparent one let the text scroll under the title
  // and the status bar. There it stays the opaque surface every other screen has.
  const hasArt = useMemo(
    () =>
      exercise !== null &&
      (exerciseImageSource(exercise.imageUrl) ?? exerciseImageSource(exercise.thumbnailUrl)) !== null,
    [exercise],
  );
  const transparent = Platform.OS === 'ios' && hasArt;
  const topInset = transparent ? transparentInset : 0;
  const contentStyle = useMemo(() => ({ paddingBottom: bottom }), [bottom]);
  const statusStyle = useMemo(() => ({ paddingTop: topInset + spacing.xl }), [topInset]);

  const title =
    exercise?.name ?? (exerciseId === null ? t('exerciseDetail.fallbackTitle') : provisionalExerciseName(exerciseId));
  const steps = useMemo(() => {
    const trimmed = (exercise?.instructions ?? []).map(step => step.trim()).filter(step => step.length > 0);
    return trimmed.length === 0 ? null : trimmed;
  }, [exercise]);

  return {
    state: {
      exercise,
      from: detail.from,
      isCatalogId: detail.isCatalogId,
      isLoading: detail.isLoading,
      error: detail.error,
      storedAt: detail.stored?.capturedAt ?? null,
      exerciseId,
      similar: similar.data ?? NO_SIMILAR,
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
      badgeTags,
      hasLead: badgeTags.length > 0 || detail.from !== 'catalog',
      steps,
    },
    effects: { retry: detail.retry, goBack, openSimilar },
  };
}
