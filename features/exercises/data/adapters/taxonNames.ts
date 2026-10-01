import { translate } from '@/features/core/translations';
import { TAXON_KEYS, type TaxonKind } from '@/features/exercises/domain/entities/taxonKeys';
import type { CatalogLanguage } from '@/features/exercises/domain/schemas/CatalogLanguage';

/**
 * The name of taxon `key` in `language`. A key the app does not name, one a later edit of the
 * dataset added, reads as itself rather than as nothing.
 */
export function taxonName(kind: TaxonKind, key: string, language: CatalogLanguage): string {
  const catalogKey = TAXON_KEYS[kind].get(key);
  return catalogKey === undefined ? key : translate(language, catalogKey);
}
