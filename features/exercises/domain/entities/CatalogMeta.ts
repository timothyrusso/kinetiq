/** What `catalog_meta` says about the installed catalog. A `null` field was never written. */
export interface CatalogMeta {
  /** The `datasetVersion` of the bundled dataset the catalog was installed from. */
  readonly datasetVersion: number | null;
  readonly installedAt: number | null;
  readonly exerciseCount: number | null;
  readonly formatVersion: number | null;
}
