import { Clock, Effect } from 'effect';
import { CatalogRepository } from '@/features/exercises/domain/repositories/CatalogRepository';
import { isCatalogStale } from '@/features/exercises/domain/utils/catalogAge';
import { refreshCatalog } from '@/features/exercises/useCases/refreshCatalog';

/**
 * The automatic refresh, after launch and on return to the foreground: stale while revalidate,
 * every 30 days. With the device online and the catalog due, it downloads and swaps; otherwise it
 * sends nothing. Succeeds with whether it refreshed. A failure is the caller's to ignore: the
 * catalog on the device is what renders, and it is left exactly as it was.
 */
export const maybeRefreshCatalog = (online: boolean) =>
  Effect.gen(function* () {
    if (!online) return false;
    const meta = yield* (yield* CatalogRepository).readMeta;
    if (!isCatalogStale(meta, yield* Clock.currentTimeMillis)) return false;
    yield* refreshCatalog;
    return true;
  });
