import { Effect } from 'effect';
import { CatalogRepository } from '@/features/exercises/domain/repositories/CatalogRepository';

/** What is installed: the exercise count and the dates, for the Your data screen. */
export const getCatalogMeta = Effect.flatMap(CatalogRepository, repository => repository.readMeta);
