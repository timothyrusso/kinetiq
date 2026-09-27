import { useEffectQuery } from '@/features/core/query';
import { currentLanguage } from '@/features/core/translations';
import type { StagedImport } from '@/features/transfer/domain/entities/ParsedImport';
import { transferQueryKeys } from '@/features/transfer/facades/transferQueryKeys';
import { resolveExercisesByName } from '@/features/transfer/useCases/resolveExercisesByName';

/**
 * The staged import's exercise matches. A query, so the preview gets loading, error and retry
 * states, and the lookups are abandoned when the preview is dismissed half way. Never cached past
 * the preview.
 */
export function useResolvedImport(staged: StagedImport | null) {
  return useEffectQuery({
    queryKey: transferQueryKeys.resolve(staged?.id ?? 'none'),
    queryFn: resolveExercisesByName(staged?.routines ?? [], currentLanguage()),
    enabled: staged !== null,
    staleTime: Number.POSITIVE_INFINITY,
    gcTime: 0,
    retry: false,
  });
}
