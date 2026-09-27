import { Context, type Effect } from 'effect';
import type { HttpError, OfflineError } from '@/features/core/error';
import type { CatalogFetchFailed } from '@/features/exercises/domain/errors/ExercisesErrors';
import type { CatalogPayload } from '@/features/exercises/domain/schemas/CatalogPayloadSchema';

/**
 * The network the catalog is downloaded from. `fetch` is all or nothing: the payload exists only
 * once the last page has arrived, so a failure anywhere leaves nothing to write. Concurrent calls
 * share one download.
 */
export class CatalogSource extends Context.Tag('exercises/CatalogSource')<
  CatalogSource,
  {
    readonly fetch: Effect.Effect<CatalogPayload, HttpError | OfflineError | CatalogFetchFailed>;
  }
>() {}
