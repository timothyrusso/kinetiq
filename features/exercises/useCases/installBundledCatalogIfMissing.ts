import { Clock, Effect } from 'effect';
import { CatalogRepository } from '@/features/exercises/domain/repositories/CatalogRepository';
import { BundledCatalog } from '@/features/exercises/domain/services/BundledCatalog';

/**
 * First-launch install of the bundled catalog, so a fresh install has the whole exercise library
 * before it has ever seen a network. Succeeds with whether it installed.
 *
 * `installed_at` is the marker, written in the same transaction as the rows: an install that dies
 * halfway leaves no marker and simply runs again next launch. On every later launch this is one
 * read of `catalog_meta`, and the bundled payload is never loaded.
 */
export const installBundledCatalogIfMissing = Effect.gen(function* () {
  const repository = yield* CatalogRepository;
  const meta = yield* repository.readMeta;
  if (meta.installedAt !== null) return false;
  const payload = yield* (yield* BundledCatalog).load;
  yield* repository.replaceCatalog(payload, 'install', yield* Clock.currentTimeMillis);
  return true;
});
