import { Context, type Effect } from 'effect';
import type { DecodeError, SqlError } from '@/features/core/error';
import type { CatalogMeta, CatalogWriteKind } from '@/features/exercises/domain/entities/CatalogMeta';
import type { CatalogLanguage } from '@/features/exercises/domain/schemas/CatalogLanguage';
import type { CatalogPayload } from '@/features/exercises/domain/schemas/CatalogPayloadSchema';
import type { ExerciseFilter } from '@/features/exercises/domain/schemas/ExerciseFilterSchema';
import type { Exercise } from '@/features/exercises/domain/schemas/ExerciseSchema';
import type { ExerciseTaxonomy } from '@/features/exercises/domain/schemas/ExerciseTaxonomySchema';

/** A read of the catalog tables: a statement failed, or a row is not the shape it should be. */
type CatalogReadError = SqlError | DecodeError;

/**
 * The exercise catalog on the device. Every read names its rows in `language` and falls back to
 * English per row; a row with neither is left out of lists and named `Exercise <n>` when asked for
 * by id.
 */
export class CatalogRepository extends Context.Tag('exercises/CatalogRepository')<
  CatalogRepository,
  {
    /**
     * Swaps the whole catalog for `payload` in one exclusive transaction, the only write the
     * catalog tables get: a failure anywhere leaves the previous catalog as it was.
     */
    readonly replaceCatalog: (
      payload: CatalogPayload,
      kind: CatalogWriteKind,
      now: number,
    ) => Effect.Effect<void, SqlError>;
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
    /** The exercise with wger id `externalId`, or `undefined` when the catalog has none. */
    readonly byId: (
      externalId: number,
      language: CatalogLanguage,
    ) => Effect.Effect<Exercise | undefined, CatalogReadError>;
    /** The other members of the exercise's variation group; never the exercise itself. */
    readonly variations: (
      externalId: number,
      language: CatalogLanguage,
    ) => Effect.Effect<readonly Exercise[], CatalogReadError>;
    /** Categories, equipment and muscles by name, muscles by their common name where wger has one. */
    readonly taxonomy: Effect.Effect<ExerciseTaxonomy, CatalogReadError>;
  }
>() {}
