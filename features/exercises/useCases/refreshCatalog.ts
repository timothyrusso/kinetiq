import { Clock, Effect } from 'effect';
import { CatalogRepository } from '@/features/exercises/domain/repositories/CatalogRepository';
import { CatalogSource } from '@/features/exercises/domain/services/CatalogSource';

/**
 * Downloads the catalog and swaps it in, whatever its age: the Refresh row. The download is all
 * or nothing and the swap is one transaction, so a failure at any point leaves the current
 * catalog untouched, and the next attempt starts from the first page.
 */
export const refreshCatalog = Effect.gen(function* () {
  const payload = yield* (yield* CatalogSource).fetch;
  const repository = yield* CatalogRepository;
  yield* repository.replaceCatalog(payload, 'refresh', yield* Clock.currentTimeMillis);
});
