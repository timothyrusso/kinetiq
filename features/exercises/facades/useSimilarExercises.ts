import { useEffectQuery } from '@/features/core/query';
import type { Exercise } from '@/features/exercises/domain/schemas/ExerciseSchema';
import { EXERCISE_GC_MS, exerciseQueryKeys } from '@/features/exercises/facades/exerciseQueryKeys';
import { useCatalogLanguage } from '@/features/exercises/facades/useCatalogLanguage';
import { getSimilarExercises } from '@/features/exercises/useCases/getSimilarExercises';

/** Up to five catalog exercises like `exercise`; none for an exercise the catalog does not have. */
export function useSimilarExercises(exercise: Exercise | null) {
  const language = useCatalogLanguage();
  return useEffectQuery({
    queryKey: exerciseQueryKeys.similar(exercise?.id ?? 'none', language),
    queryFn: getSimilarExercises(exercise?.id ?? '', language),
    enabled: exercise !== null && exercise.source === 'catalog',
    staleTime: Infinity,
    gcTime: EXERCISE_GC_MS,
  });
}
