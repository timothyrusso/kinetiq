import { useEffectQuery } from '@/features/core/query';
import { exerciseQueryKeys } from '@/features/exercises/facades/exerciseQueryKeys';
import { getCatalogMeta } from '@/features/exercises/useCases/getCatalogMeta';

/**
 * What is installed, for the Your data row. A refresh is the only thing that changes it, and every
 * refresh invalidates `catalog`, so it never goes stale on a timer.
 */
export function useCatalogMeta() {
  return useEffectQuery({ queryKey: exerciseQueryKeys.catalogMeta(), queryFn: getCatalogMeta, staleTime: Infinity });
}
