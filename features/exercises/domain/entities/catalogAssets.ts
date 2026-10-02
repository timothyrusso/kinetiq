/**
 * Where the bundled dataset's files sit, from the repository root. The dataset names its images
 * relative to it (`images/<slug>/0.webp`); the catalog and the snapshots store the full asset
 * path, a stable string any later build can resolve to its own copy of the file.
 */
export const CATALOG_ASSET_ROOT = 'assets/catalog/';
