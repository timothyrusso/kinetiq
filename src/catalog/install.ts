/**
 * First-launch install of the bundled catalog.
 *
 * `assets/catalog/wger.json` is committed and ships in the bundle, so a fresh install has the
 * whole exercise library before it has ever seen a network. It is `require`d lazily, inside the
 * branch that needs it: on every launch after the first, the JSON is never evaluated.
 *
 * `installed_at` in `catalog_meta` is the marker. It is written in the same transaction as the
 * rows, so an install that dies halfway leaves no marker and simply runs again next launch.
 */
import { readCatalogMeta, replaceCatalog } from './repository';
import type { CatalogPayload } from './types';

export async function installBundledCatalogIfMissing(): Promise<void> {
  const meta = await readCatalogMeta();
  if (meta.installedAt !== null) return;
  const started = Date.now();
  const payload = require('../../assets/catalog/wger.json') as CatalogPayload;
  const loaded = Date.now();
  await replaceCatalog(payload, 'install');
  if (__DEV__) {
    const done = Date.now();
    console.info(
      `[catalog] installed ${payload.exercises.length} exercises in ${done - started} ms ` +
        `(load ${loaded - started} ms, write ${done - loaded} ms)`,
    );
  }
}
