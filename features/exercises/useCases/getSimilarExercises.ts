import { Effect } from 'effect';
import { CatalogRepository } from '@/features/exercises/domain/repositories/CatalogRepository';
import type { CatalogLanguage } from '@/features/exercises/domain/schemas/CatalogLanguage';
import { isCatalogExerciseId } from '@/features/exercises/domain/utils/exerciseId';

/**
 * Up to five catalog exercises like `id` (the same first primary muscle, then mechanic, then
 * equipment), named in `language`. Empty for an id the catalog cannot have, and never the
 * exercise itself.
 */
export const getSimilarExercises = (id: string, language: CatalogLanguage) =>
  Effect.gen(function* () {
    if (!isCatalogExerciseId(id)) return [];
    return yield* (yield* CatalogRepository).similar(id, language);
  });
