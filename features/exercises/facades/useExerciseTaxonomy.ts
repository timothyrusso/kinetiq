import { useEffectQuery } from '@/features/core/query';
import type { ExerciseTaxonomy } from '@/features/exercises/domain/schemas/ExerciseTaxonomySchema';
import { EXERCISE_GC_MS, exerciseQueryKeys } from '@/features/exercises/facades/exerciseQueryKeys';
import { getTaxonomy } from '@/features/exercises/useCases/getTaxonomy';

/** One stable empty value, so filter rows reading `categories` do not re-render. */
const EMPTY_TAXONOMY: ExerciseTaxonomy = { categories: [], equipment: [], muscles: [] };

/**
 * The filter vocabulary, a few dozen rows that change only with the catalog. Filters are optional,
 * so while it loads, or when it fails, the lists are empty and searching still works.
 *
 * @param active see `useExerciseSearch`.
 */
export function useExerciseTaxonomy(active = true) {
  return useEffectQuery({
    queryKey: exerciseQueryKeys.taxonomy(),
    queryFn: getTaxonomy,
    enabled: active,
    placeholderData: EMPTY_TAXONOMY,
    staleTime: Infinity,
    gcTime: EXERCISE_GC_MS,
  });
}
