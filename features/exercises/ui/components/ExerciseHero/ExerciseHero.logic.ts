import { useCallback, useMemo, useState } from 'react';
import type { Exercise } from '@/features/exercises/domain/schemas/ExerciseSchema';
import { exerciseImageSource } from '@/features/exercises/mappers/exerciseImageSource';

/** Height of the art slot below the floating bar. */
const ART_HEIGHT = 260;

/** The no-art composition's height: close to `ART_HEIGHT`, so content below does not jump. */
const NO_ART_HEIGHT = 270;

/**
 * The hero's bundled photo and whether it failed to load. The failure is keyed by the image, so
 * moving to another exercise (the similar exercises list reuses this screen) starts from "try to
 * load it" rather than inheriting the last one's failure.
 */
export function useExerciseHeroLogic(exercise: Exercise, topInset: number) {
  const source = useMemo(
    () => exerciseImageSource(exercise.imageUrl) ?? exerciseImageSource(exercise.thumbnailUrl),
    [exercise.imageUrl, exercise.thumbnailUrl],
  );
  const [failedSource, setFailedSource] = useState<number | null>(null);
  const markFailed = useCallback(() => setFailedSource(source), [source]);
  const artStyle = useMemo(() => ({ height: topInset + ART_HEIGHT, paddingTop: topInset }), [topInset]);
  const noArtStyle = useMemo(() => ({ height: topInset + NO_ART_HEIGHT, paddingTop: topInset }), [topInset]);

  return {
    state: { source: source !== null && failedSource !== source ? source : null, hasArt: source !== null },
    derived: { artStyle, noArtStyle },
    effects: { markFailed },
  };
}
