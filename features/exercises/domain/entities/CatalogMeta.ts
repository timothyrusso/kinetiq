/** What `catalog_meta` says about the installed catalog. A `null` field was never written. */
export interface CatalogMeta {
  readonly source: string | null;
  readonly generatedAt: number | null;
  readonly installedAt: number | null;
  readonly refreshedAt: number | null;
  readonly exerciseCount: number | null;
  readonly formatVersion: number | null;
}

/**
 * Why the catalog is being written: `install` stamps `installed_at`; `refresh` keeps the install
 * date and stamps `refreshed_at`, so the Your data screen can date the last refresh.
 */
export type CatalogWriteKind = 'install' | 'refresh';
