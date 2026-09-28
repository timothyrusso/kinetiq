import { translate } from '@/features/core/translations';
import { TAXON_KEYS, type TaxonKind } from '@/features/exercises/domain/entities/taxonKeys';
import type { CatalogLanguage } from '@/features/exercises/domain/schemas/CatalogLanguage';

/**
 * The name of wger taxon `id` in `language`. An id the app does not name, one a later catalog
 * added, keeps the name stored with the catalog.
 */
export function taxonName(kind: TaxonKind, id: number, stored: string, language: CatalogLanguage): string {
  const key = TAXON_KEYS[kind].get(id);
  return key === undefined ? stored : translate(language, key);
}
