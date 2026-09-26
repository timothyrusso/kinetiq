/**
 * The exercise catalog as the Your data screen sees it: what is installed, and a way to
 * refresh it.
 *
 * The meta query has no stale time of its own to speak of: `replaceCatalog` is the only thing
 * that changes it, and every refresh invalidates `queryKeys.catalog.all`.
 */
import { useMutation, useQuery } from '@tanstack/react-query';

import { readCatalogMeta } from '@/catalog/repository';
import { refreshCatalogNow } from '@/catalog/refresh';
import { queryKeys } from '@/query/keys';

export function useCatalogMeta() {
  return useQuery({
    queryKey: queryKeys.catalog.meta(),
    queryFn: readCatalogMeta,
    staleTime: Infinity,
  });
}

/**
 * The manual refresh. A mutation rather than a fire-and-forget call, so the row can read
 * `isPending` and `error`; the mutation defaults already run it with no network, which is what
 * lets it fail at once with the offline error instead of waiting for a connection.
 */
export function useRefreshCatalog() {
  return useMutation({ mutationFn: refreshCatalogNow });
}
