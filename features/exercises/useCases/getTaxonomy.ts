import { Effect } from 'effect';
import { CatalogRepository } from '@/features/exercises/domain/repositories/CatalogRepository';

/** The filter vocabulary: categories, equipment and muscles, each by name. */
export const getTaxonomy = Effect.flatMap(CatalogRepository, repository => repository.taxonomy);
