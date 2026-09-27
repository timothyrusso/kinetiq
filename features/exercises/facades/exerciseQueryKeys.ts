import type { CatalogLanguage } from '@/features/exercises/domain/schemas/CatalogLanguage';
import type { ExerciseFilter } from '@/features/exercises/domain/schemas/ExerciseFilterSchema';

/**
 * The catalog's query keys. Every input to a query appears in its key, and the render language is
 * one: without it, switching the app to Italian would keep showing the cached English rows. Every
 * key sits under `exercises` or `catalog`, so a refresh invalidates the whole catalog in two calls.
 */
export const exerciseQueryKeys = {
  all: ['exercises'] as const,
  list: (filter: ExerciseFilter, language: CatalogLanguage, limit: number) =>
    ['exercises', 'list', language, filter, { limit }] as const,
  taxonomy: () => ['exercises', 'taxonomy'] as const,
  detail: (id: string, language: CatalogLanguage) => ['exercises', 'detail', language, id] as const,
  stored: (id: string) => ['exercises', 'stored', id] as const,
  variations: (id: string, language: CatalogLanguage) => ['exercises', 'variations', language, id] as const,
  catalog: ['catalog'] as const,
  catalogMeta: () => ['catalog', 'meta'] as const,
};

/**
 * How long an unused catalog query stays in memory. Re-reading SQLite is cheap, so this only
 * bounds memory: a picker session's filters survive, last week's do not.
 */
export const EXERCISE_GC_MS = 10 * 60_000;
