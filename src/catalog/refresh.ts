/**
 * Keeping the local catalog fresh: stale-while-revalidate, every 30 days.
 *
 * The catalog on the device is always what renders. When it is older than
 * `CATALOG_MAX_AGE_MS` and the device is online, a background download replaces it; until the
 * download has fully arrived, nothing changes. The download is all-or-nothing (`fetchCatalog`
 * holds every page in memory) and the swap is one transaction (`replaceCatalog`), so a failure
 * at any point leaves the current catalog untouched, and the next attempt starts from page 1.
 *
 * ## Age
 *
 * Measured from `generated_at`, when the data was fetched from wger, not from when it was
 * installed. A fresh install of a snapshot built two months ago is two months stale, and
 * refreshes early; after a refresh the two dates coincide.
 *
 * ## Two entry points, one download
 *
 * - `maybeRefreshCatalog()` is the automatic path (after launch, on foreground). It checks the
 *   network and the age, and swallows failures: they are logged and retried next launch, and a
 *   user who never asked for a download never sees an error about one.
 * - `refreshCatalogNow()` is the "Refresh" row. It skips the age check and rethrows, so the row
 *   can show what went wrong.
 *
 * Both share one in-flight promise, so a foreground event during a manual refresh, or a double
 * tap, never starts a second download.
 */
import { requestJson } from '@/api/http';
import { getQueryClient } from '@/query/client';
import { queryKeys } from '@/query/keys';
import { getNetworkStatus, subscribeNetworkStatus } from '@/query/networkStatus';
import { fetchCatalog } from './fetchCatalog';
import { readCatalogMeta, replaceCatalog } from './repository';
import type { CatalogMeta } from './types';

export const CATALOG_MAX_AGE_MS = 30 * 24 * 60 * 60_000;

/** Per page. An `exerciseinfo` page of 100 rows is close to a megabyte of JSON. */
const PAGE_TIMEOUT_MS = 60_000;

/** True when the catalog is due a refresh. A catalog with no dates at all is always due. */
export function isCatalogStale(meta: CatalogMeta, now: number = Date.now()): boolean {
  const reference = meta.generatedAt ?? meta.refreshedAt ?? meta.installedAt;
  return reference === null || now - reference >= CATALOG_MAX_AGE_MS;
}

let inFlight: Promise<void> | null = null;

async function download(): Promise<void> {
  const payload = await fetchCatalog(
    async (url) => (await requestJson<unknown>(url, '', { timeoutMs: PAGE_TIMEOUT_MS })).data,
    {
      log: (message) => {
        if (__DEV__) console.info(`[catalog] ${message}`);
      },
    },
  );
  await replaceCatalog(payload, 'refresh');
  const client = getQueryClient();
  await Promise.all([
    client.invalidateQueries({ queryKey: queryKeys.exercises.all }),
    client.invalidateQueries({ queryKey: queryKeys.catalog.all }),
  ]);
}

/** The one download, shared by whoever asks while it runs. */
function runOnce(): Promise<void> {
  if (!inFlight) {
    inFlight = download().finally(() => {
      inFlight = null;
    });
  }
  return inFlight;
}

/** The Refresh row: always downloads, and rejects so the row can show the reason. */
export function refreshCatalogNow(): Promise<void> {
  return runOnce();
}

/** The automatic path: online, stale and not already running, or nothing. Never rejects. */
export async function maybeRefreshCatalog(now: number = Date.now()): Promise<void> {
  try {
    if (inFlight) return await inFlight;
    if (!getNetworkStatus().online) return;
    if (!isCatalogStale(await readCatalogMeta(), now)) return;
    await runOnce();
  } catch (error) {
    if (__DEV__) console.warn('[catalog] background refresh failed; the current catalog stays', error);
  }
}

/**
 * The launch trigger. The network probe may not have answered yet when the app becomes ready,
 * and its optimistic `online: true` would send a request into a dead radio; so this waits for the
 * first real answer, once, and then asks.
 */
export function scheduleCatalogRefresh(): void {
  if (getNetworkStatus().known) {
    void maybeRefreshCatalog();
    return;
  }
  const unsubscribe = subscribeNetworkStatus(() => {
    if (!getNetworkStatus().known) return;
    unsubscribe();
    void maybeRefreshCatalog();
  });
}
