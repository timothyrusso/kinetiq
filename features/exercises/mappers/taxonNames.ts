import { translate } from '@/features/core/translations';
import { TAXON_KEYS, type TaxonKey, type TaxonKind } from '@/features/exercises/domain/entities/taxonKeys';
import { CATALOG_LANGUAGES, type CatalogLanguage } from '@/features/exercises/domain/schemas/CatalogLanguage';

/**
 * The catalog key of the taxon `name` names, in any catalog language, or `undefined` for a name
 * the app does not know. A stored snapshot keeps names, not keys, each in the language of the day
 * it was stored, and a copy from the previous catalog may hold a name the app no longer has.
 */
function taxonKeyOf(kind: TaxonKind, name: string): TaxonKey | undefined {
  for (const key of TAXON_KEYS[kind].values()) {
    if (CATALOG_LANGUAGES.some(language => translate(language, key) === name)) return key;
  }
  return undefined;
}

/**
 * The taxon stored as `stored`, whatever language it was stored in, named in `language`. A name
 * the app does not know is kept as stored.
 */
export function storedTaxonName(kind: TaxonKind, stored: string, language: CatalogLanguage): string {
  const key = taxonKeyOf(kind, stored);
  return key === undefined ? stored : translate(language, key);
}
