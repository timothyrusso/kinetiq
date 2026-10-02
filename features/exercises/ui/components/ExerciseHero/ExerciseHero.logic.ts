import { useIsFocused } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import type { TKey } from '@/features/core/translations';
import type { Exercise } from '@/features/exercises/domain/schemas/ExerciseSchema';
import { isCatalogExerciseId } from '@/features/exercises/domain/utils/exerciseId';
import { exerciseImageSource } from '@/features/exercises/mappers/exerciseImageSource';

/** The no-art composition's height: close to a 3:2 photo across a phone, so content below does not jump. */
const NO_ART_HEIGHT = 270;

/**
 * The caption under the no-art composition. A bundled photo that failed to load says so; a
 * catalog exercise without one may get it in a later dataset, so it says "yet"; a custom
 * exercise, or one the catalog no longer has, never gets a bundled photo, so it does not.
 */
export function noArtCaptionKey(id: string, hasArt: boolean): TKey {
  if (hasArt) return 'exerciseDetail.imageUnavailable';
  return isCatalogExerciseId(id) ? 'exerciseDetail.noImage' : 'exerciseDetail.noBundledImage';
}

/**
 * The hero's two bundled photos, the cross-fade between them and whether the start frame failed
 * to load. The failure is keyed by the image, so moving to another exercise (the similar exercises
 * list reuses this screen) starts from "try to load it" rather than inheriting the last one's
 * failure. The loop runs only while this screen is the focused one, and only when there is an end
 * frame to fade to (`CrossFadeImage` checks that).
 */
export function useExerciseHeroLogic(exercise: Exercise, topInset: number) {
  const start = useMemo(
    () => exerciseImageSource(exercise.imageUrl) ?? exerciseImageSource(exercise.thumbnailUrl),
    [exercise.imageUrl, exercise.thumbnailUrl],
  );
  const end = useMemo(() => exerciseImageSource(exercise.imageEndUrl), [exercise.imageEndUrl]);
  const [failedSource, setFailedSource] = useState<number | null>(null);
  const markFailed = useCallback(() => setFailedSource(start), [start]);
  const shown = start !== null && failedSource !== start ? start : null;
  const focused = useIsFocused();
  const artStyle = useMemo(() => ({ paddingTop: topInset }), [topInset]);
  const noArtStyle = useMemo(() => ({ height: topInset + NO_ART_HEIGHT, paddingTop: topInset }), [topInset]);

  return {
    state: {
      start: shown,
      end: shown === null ? null : end,
      animating: focused,
      caption: noArtCaptionKey(exercise.id, start !== null),
    },
    derived: { artStyle, noArtStyle },
    effects: { markFailed },
  };
}
