/**
 * Query keys.
 *
 * Keys are the cache's only addressable surface, so they are the one place where
 * getting the shape right has lasting value. Two rules this file enforces:
 *
 * - **Every input to a query function appears in that query's key.** An omitted
 *   input means two different results share one cache slot, which reads as
 *   "the filter is broken".
 * - **Prefixes are meaningful.** `['activities', 'list', …]` sits under
 *   `['activities']`, so invalidating a whole feature is one call
 *   (`invalidateActivities`) rather than a list of keys that drifts out of date
 *   as filters are added.
 */
import type { CatalogLanguage } from '@/catalog/types';
import type { ExerciseFilter } from '@/domain/types';

export const queryKeys = {
  activities: {
    all: ['activities'] as const,
    /** Every session, newest first: the only list, so its key has no parameters. */
    list: () => ['activities', 'list'] as const,
    detail: (id: string) => ['activities', 'detail', id] as const,
  },

  progress: {
    all: ['progress'] as const,
    /** Keyed by the requested window in weeks; the start date is derived from it
     * inside the query, so it would be redundant (and stale-prone) in the key. */
    summary: (rangeWeeks: number) => ['progress', 'summary', { rangeWeeks }] as const,
    heatmap: (weeks: number) => ['progress', 'heatmap', { weeks }] as const,
  },

  routines: {
    all: ['routines'] as const,
    list: () => ['routines', 'list'] as const,
    detail: (id: string) => ['routines', 'detail', id] as const,
    snapshots: (id: string) => ['routines', 'snapshots', id] as const,
  },

  session: {
    all: ['session'] as const,
    active: () => ['session', 'active'] as const,
    previousPerformance: (routineId: string) =>
      ['session', 'previous', routineId] as const,
  },

  exercises: {
    all: ['exercises'] as const,
    taxonomy: () => ['exercises', 'taxonomy'] as const,
    /**
     * The render language is an input: the provider names each row in it. Without it in the
     * key, switching the app to Italian would keep showing the cached English page.
     */
    list: (filter: ExerciseFilter, language: CatalogLanguage) =>
      ['exercises', 'list', language, filter] as const,
    detail: (id: string, language: CatalogLanguage) =>
      ['exercises', 'detail', language, id] as const,
    variations: (id: string, language: CatalogLanguage) =>
      ['exercises', 'variations', language, id] as const,
  },

  catalog: {
    all: ['catalog'] as const,
    /** What `catalog_meta` says: exercise count and dates, for the Your data row. */
    meta: () => ['catalog', 'meta'] as const,
  },

  transfer: {
    /** One staged import's exercise matches; the id changes with every paste or file. */
    resolve: (importId: string) => ['transfer', 'resolve', importId] as const,
  },

  settings: {
    /**
     * Settings live in the external store, not the cache: they are read by
     * non-component code, they change while typing, and caching them here would
     * give two async sources of truth for one value. This key exists only so
     * other queries can invalidate on a units change without importing the store.
     */
    all: ['settings'] as const,
  },
} as const;
