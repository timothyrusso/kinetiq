import { useCallback, useMemo, useState } from 'react';
import type { Exercise } from '@/features/exercises/domain/schemas/ExerciseSchema';

/** Height of the art slot below the floating bar: wger's drawings are small and need the room. */
const ART_HEIGHT = 260;

/** The no-art composition's height: close to `ART_HEIGHT`, so content below does not jump. */
const NO_ART_HEIGHT = 270;

/**
 * The hero's art and whether it failed to load. The failure is keyed by URL, so moving to another
 * exercise (the variations list reuses this screen) starts from "try to load it" rather than
 * inheriting the last one's failure.
 */
export function useExerciseHeroLogic(exercise: Exercise, topInset: number) {
  const uri = exercise.imageUrl ?? exercise.thumbnailUrl;
  const [failedUri, setFailedUri] = useState<string | null>(null);
  const markFailed = useCallback(() => setFailedUri(uri), [uri]);
  const artStyle = useMemo(() => ({ height: topInset + ART_HEIGHT, paddingTop: topInset }), [topInset]);
  const noArtStyle = useMemo(() => ({ height: topInset + NO_ART_HEIGHT, paddingTop: topInset }), [topInset]);

  return {
    state: { uri: uri !== null && failedUri !== uri ? uri : null, hasArt: uri !== null },
    derived: { artStyle, noArtStyle },
    effects: { markFailed },
  };
}
