import { useQueryClient } from '@tanstack/react-query';
import { useEffectMutation } from '@/features/core/query';
import { exerciseQueryKeys } from '@/features/exercises/facades/exerciseQueryKeys';
import { refreshCatalog } from '@/features/exercises/useCases/refreshCatalog';

/**
 * The manual refresh. A mutation, so the row can read `isPending` and `error`; mutations run with
 * no network, so an offline refresh fails at once with the offline error instead of waiting for a
 * connection. It settles once every catalog query has been invalidated.
 */
export function useRefreshCatalog() {
  const queryClient = useQueryClient();
  return useEffectMutation({
    mutationFn: () => refreshCatalog,
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: exerciseQueryKeys.all }),
        queryClient.invalidateQueries({ queryKey: exerciseQueryKeys.catalog }),
      ]),
  });
}
