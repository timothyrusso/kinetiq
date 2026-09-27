import { Schema } from 'effect';

/** The languages the catalog keeps a translation in: the app's two. */
export const CatalogLanguage = Schema.Literal('en', 'it');

export type CatalogLanguage = typeof CatalogLanguage.Type;

/** Every catalog language, in the order the translations are written. */
export const CATALOG_LANGUAGES: readonly CatalogLanguage[] = CatalogLanguage.literals;
