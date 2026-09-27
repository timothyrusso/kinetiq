import { useEffectQuery } from '@/features/core/query';
import type { Exercise } from '@/features/exercises/domain/schemas/ExerciseSchema';
import { EXERCISE_GC_MS, exerciseQueryKeys } from '@/features/exercises/facades/exerciseQueryKeys';
import { useCatalogLanguage } from '@/features/exercises/facades/useCatalogLanguage';
import { getVariations } from '@/features/exercises/useCases/getVariations';

/** The other exercises in `exercise`'s variation family. */
export function useExerciseVariations(exercise: Exercise | null) {
  const language = useCatalogLanguage();
  return useEffectQuery({
    queryKey: exerciseQueryKeys.variations(exercise?.id ?? 'none', language),
    queryFn: getVariations(exercise?.id ?? '', language),
    enabled: exercise !== null && exercise.externalId !== null,
    staleTime: Infinity,
    gcTime: EXERCISE_GC_MS,
  });
}
