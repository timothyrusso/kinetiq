import { Effect } from 'effect';
import { ExerciseNotFound } from '@/features/exercises/domain/errors/ExercisesErrors';
import { CatalogRepository } from '@/features/exercises/domain/repositories/CatalogRepository';
import type { CatalogLanguage } from '@/features/exercises/domain/schemas/CatalogLanguage';
import { externalIdOf } from '@/features/exercises/domain/utils/exerciseId';

/**
 * The catalog's exercise `id`, named in `language`. `ExerciseNotFound` when the catalog has no
 * such row, which is always the case for a `local:` id.
 */
export const getExercise = (id: string, language: CatalogLanguage) =>
  Effect.gen(function* () {
    const externalId = externalIdOf(id);
    const exercise = externalId === null ? undefined : yield* (yield* CatalogRepository).byId(externalId, language);
    if (exercise === undefined) return yield* new ExerciseNotFound({ exerciseId: id });
    return exercise;
  });
