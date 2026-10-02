import { Clock, Effect } from 'effect';
import { CatalogRepository } from '@/features/exercises/domain/repositories/CatalogRepository';
import { BundledCatalog } from '@/features/exercises/domain/services/BundledCatalog';

/**
 * Installs the bundled dataset when the device has none, or one older than the bundle's, so a
 * fresh install has the whole exercise library before it has ever seen a network and an edit of
 * the dataset reaches existing installs on their next launch. Succeeds with whether it installed.
 *
 * `dataset_version` is the marker, written in the same transaction as the rows: an install that
 * dies halfway leaves the old marker and simply runs again next launch. On every later launch this
 * is one read of `catalog_meta` and one of `version.json`, and the dataset is never loaded.
 */
export const installBundledCatalogIfNewer = Effect.gen(function* () {
  const repository = yield* CatalogRepository;
  const bundled = yield* BundledCatalog;
  const installed = (yield* repository.readMeta).datasetVersion;
  if (installed !== null && installed >= (yield* bundled.version)) return false;
  yield* repository.replaceCatalog(yield* bundled.load, yield* Clock.currentTimeMillis);
  return true;
});
