import { Effect } from 'effect';
import { CatalogRepository } from '@/features/exercises/domain/repositories/CatalogRepository';
import type { CatalogLanguage } from '@/features/exercises/domain/schemas/CatalogLanguage';

/** The filter vocabulary: categories, equipment and muscles, each by name in `language`. */
export const getTaxonomy = (language: CatalogLanguage) =>
  Effect.flatMap(CatalogRepository, repository => repository.taxonomy(language));
