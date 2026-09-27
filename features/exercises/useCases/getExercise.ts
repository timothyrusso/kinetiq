import { Effect } from 'effect';
import { CatalogRepository } from '@/features/exercises/domain/repositories/CatalogRepository';
import type { CatalogLanguage } from '@/features/exercises/domain/schemas/CatalogLanguage';
import { externalIdOf } from '@/features/exercises/domain/utils/exerciseId';

/**
 * The catalog's exercise `id`, named in `language`, or null when the catalog has no such row:
 * an exercise wger has since retired, and always a `local:` id. An answer, not a failure: the
 * screen falls back to the stored snapshot, and nothing is logged for an exercise the catalog
 * never had.
 */
export const getExercise = (id: string, language: CatalogLanguage) =>
  Effect.gen(function* () {
    const externalId = externalIdOf(id);
    if (externalId === null) return null;
    return (yield* (yield* CatalogRepository).byId(externalId, language)) ?? null;
  });
