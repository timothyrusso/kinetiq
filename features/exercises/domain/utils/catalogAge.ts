import type { CatalogMeta } from '@/features/exercises/domain/entities/CatalogMeta';

/** How old the catalog may get before the automatic refresh downloads a new one. */
export const CATALOG_MAX_AGE_MS = 30 * 24 * 60 * 60_000;

/**
 * True when the catalog is due a refresh. The age is measured from `generatedAt`, when the data
 * was fetched from wger, not from the install: a snapshot built two months ago is two months
 * stale on the day it is installed. A catalog with no dates at all is always due.
 */
export function isCatalogStale(meta: CatalogMeta, now: number): boolean {
  const reference = meta.generatedAt ?? meta.refreshedAt ?? meta.installedAt;
  return reference === null || now - reference >= CATALOG_MAX_AGE_MS;
}
