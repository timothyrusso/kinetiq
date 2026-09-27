import { Effect } from 'effect';
import { CatalogRepository } from '@/features/exercises/domain/repositories/CatalogRepository';
import type { CatalogLanguage } from '@/features/exercises/domain/schemas/CatalogLanguage';
import { externalIdOf } from '@/features/exercises/domain/utils/exerciseId';

/**
 * The other exercises in `id`'s variation family (the grip variants of a bench press), named in
 * `language`. Empty for an exercise with no family or no catalog row, and never the exercise
 * itself.
 */
export const getVariations = (id: string, language: CatalogLanguage) =>
  Effect.gen(function* () {
    const externalId = externalIdOf(id);
    if (externalId === null) return [];
    return yield* (yield* CatalogRepository).variations(externalId, language);
  });
