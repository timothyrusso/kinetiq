import { Context, type Effect } from 'effect';
import type { CatalogNotInstalled } from '@/features/exercises/domain/errors/ExercisesErrors';
import type { CatalogPayload } from '@/features/exercises/domain/schemas/CatalogPayloadSchema';

/**
 * The dataset shipped with the app, installed on first launch so day one works offline, and
 * again whenever a build ships a newer one.
 */
export class BundledCatalog extends Context.Tag('exercises/BundledCatalog')<
  BundledCatalog,
  {
    /** The bundled `datasetVersion`, read without loading the dataset. */
    readonly version: Effect.Effect<number, CatalogNotInstalled>;
    readonly load: Effect.Effect<CatalogPayload, CatalogNotInstalled>;
  }
>() {}
