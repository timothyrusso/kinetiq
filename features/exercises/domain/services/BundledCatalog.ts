import { Context, type Effect } from 'effect';
import type { CatalogNotInstalled } from '@/features/exercises/domain/errors/ExercisesErrors';
import type { CatalogPayload } from '@/features/exercises/domain/schemas/CatalogPayloadSchema';

/** The catalog shipped with the app, installed on first launch so day one works offline. */
export class BundledCatalog extends Context.Tag('exercises/BundledCatalog')<
  BundledCatalog,
  {
    readonly load: Effect.Effect<CatalogPayload, CatalogNotInstalled>;
  }
>() {}
