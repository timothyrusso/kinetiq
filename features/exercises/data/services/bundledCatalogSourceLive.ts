import { Effect, Layer, Schema } from 'effect';
import { CatalogNotInstalled } from '@/features/exercises/domain/errors/CatalogNotInstalled';
import { CatalogPayloadSchema } from '@/features/exercises/domain/schemas/CatalogPayloadSchema';
import { BundledCatalog } from '@/features/exercises/domain/services/BundledCatalog';

const decodePayload = Schema.decodeUnknown(CatalogPayloadSchema);

/**
 * `assets/catalog/wger.json`, committed and shipped in the bundle. It is `require`d inside `load`,
 * so on every launch after the first, when nothing loads it, the JSON is never evaluated.
 */
export const BundledCatalogSourceLive = Layer.succeed(BundledCatalog, {
  load: Effect.sync((): unknown => require('@/assets/catalog/wger.json')).pipe(
    Effect.flatMap(decodePayload),
    Effect.mapError(cause => new CatalogNotInstalled({ cause })),
  ),
});
