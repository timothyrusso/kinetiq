import { Context, type Effect } from 'effect';
import type { DecodeError, SqlError } from '@/features/core/error';
import type { CatalogMeta } from '@/features/exercises/domain/entities/CatalogMeta';
import type { CatalogLanguage } from '@/features/exercises/domain/schemas/CatalogLanguage';
import type { CatalogPayload } from '@/features/exercises/domain/schemas/CatalogPayloadSchema';
import type { ExerciseFilter } from '@/features/exercises/domain/schemas/ExerciseFilterSchema';
import type { ExerciseId } from '@/features/exercises/domain/schemas/ExerciseId';
import type { Exercise } from '@/features/exercises/domain/schemas/ExerciseSchema';
import type { ExerciseTaxonomy } from '@/features/exercises/domain/schemas/ExerciseTaxonomySchema';

/** A read of the catalog tables: a statement failed, or a row is not the shape it should be. */
type CatalogReadError = SqlError | DecodeError;

/**
 * The exercise catalog on the device. Every read names its rows in `language` and falls back to
 * English per row; body areas, muscles and equipment are named through the app's own catalog.
 */
export class CatalogRepository extends Context.Tag('exercises/CatalogRepository')<
  CatalogRepository,
  {
    /**
     * Swaps the whole catalog for `payload` in one exclusive transaction, the only write the
     * catalog tables get: a failure anywhere leaves the previous catalog as it was.
     */
    readonly replaceCatalog: (payload: CatalogPayload, now: number) => Effect.Effect<void, SqlError>;
    readonly readMeta: Effect.Effect<CatalogMeta, CatalogReadError>;
    /**
     * `limit` rows of the filtered list from `offset`, ordered by name in `language` (by relevance
     * first when there is a search term), with the filtered total.
     */
    readonly page: (
      filter: ExerciseFilter,
      language: CatalogLanguage,
      offset: number,
      limit: number,
    ) => Effect.Effect<{ readonly items: readonly Exercise[]; readonly total: number }, CatalogReadError>;
    /** The exercise `id`, or `undefined` when the catalog has none. */
    readonly byId: (id: ExerciseId, language: CatalogLanguage) => Effect.Effect<Exercise | undefined, CatalogReadError>;
    /**
     * Up to five other exercises with `id`'s first primary muscle among their primary muscles:
     * the same mechanic first, then the most equipment in common, then by name. Never `id` itself.
     */
    readonly similar: (
      id: ExerciseId,
      language: CatalogLanguage,
    ) => Effect.Effect<readonly Exercise[], CatalogReadError>;
    /** The body areas, equipment and muscles the catalog uses, each named and ordered in `language`. */
    readonly taxonomy: (language: CatalogLanguage) => Effect.Effect<ExerciseTaxonomy, CatalogReadError>;
  }
>() {}
