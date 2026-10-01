import { Effect } from 'effect';
import { CatalogRepository } from '@/features/exercises/domain/repositories/CatalogRepository';
import type { CatalogLanguage } from '@/features/exercises/domain/schemas/CatalogLanguage';
import type { ExerciseFilter } from '@/features/exercises/domain/schemas/ExerciseFilterSchema';
import type { ExercisePage } from '@/features/exercises/domain/schemas/ExercisePageSchema';

/** Rows per page. Local pages are cheap, but a page is still what a list renders at once. */
export const EXERCISE_PAGE_SIZE = 50;

/**
 * `limit` catalog rows matching `filter` from `offset`, named in `language`, with the filtered
 * total and the offset of the next page.
 */
export const searchExercises = (
  filter: ExerciseFilter,
  language: CatalogLanguage,
  offset = 0,
  limit = EXERCISE_PAGE_SIZE,
) =>
  Effect.gen(function* () {
    const { items, total } = yield* (yield* CatalogRepository).page(filter, language, offset, limit);
    const reached = offset + items.length;
    return {
      items,
      total,
      nextOffset: items.length > 0 && reached < total ? reached : null,
    } satisfies ExercisePage;
  });
