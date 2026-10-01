import { Context, type Effect } from 'effect';
import type { DecodeError, SqlError } from '@/features/core/error';
import type { CatalogNotInstalled } from '@/features/exercises/domain/errors/ExercisesErrors';
import type { CatalogLanguage } from '@/features/exercises/domain/schemas/CatalogLanguage';
import type { Exercise } from '@/features/exercises/domain/schemas/ExerciseSchema';

/** A read of the catalog tables: a statement failed, or a row is not the shape it should be. */
type CatalogReadError = SqlError | DecodeError;

/**
 * The catalog as the features above this one use it: the launch installs it, the routine importer
 * looks exercises up in it. The rules stay in this feature's use cases.
 */
export class ExerciseCatalog extends Context.Tag('exercises/ExerciseCatalog')<
  ExerciseCatalog,
  {
    /**
     * Installs the bundled dataset when the device has none or an older one, and succeeds with
     * whether it did.
     */
    readonly installBundledIfNewer: Effect.Effect<boolean, CatalogReadError | CatalogNotInstalled>;
    /** The catalog's exercise `id` named in `language`, or `undefined` when it has none. */
    readonly find: (id: string, language: CatalogLanguage) => Effect.Effect<Exercise | undefined, CatalogReadError>;
    /** The first page of a search for `name` in `language`, best match first. */
    readonly search: (name: string, language: CatalogLanguage) => Effect.Effect<readonly Exercise[], CatalogReadError>;
  }
>() {}
