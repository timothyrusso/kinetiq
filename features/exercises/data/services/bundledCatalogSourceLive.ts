import { Effect, Layer, Schema } from 'effect';
import { CatalogNotInstalled } from '@/features/exercises/domain/errors/CatalogNotInstalled';
import { CatalogPayloadSchema, CatalogVersionSchema } from '@/features/exercises/domain/schemas/CatalogPayloadSchema';
import { BundledCatalog } from '@/features/exercises/domain/services/BundledCatalog';

const decodePayload = Schema.decodeUnknown(CatalogPayloadSchema);
const decodeVersion = Schema.decodeUnknown(CatalogVersionSchema);

/**
 * `assets/catalog/exercises.json` and its `version.json`, committed and shipped in the bundle.
 * Each is `require`d inside its Effect, so a launch that finds the catalog current reads the few
 * bytes of the version and never evaluates the dataset.
 */
export const BundledCatalogSourceLive = Layer.succeed(BundledCatalog, {
  version: Effect.sync((): unknown => require('@/assets/catalog/version.json')).pipe(
    Effect.flatMap(decodeVersion),
    Effect.map(version => version.datasetVersion),
    Effect.mapError(cause => new CatalogNotInstalled({ cause })),
  ),
  load: Effect.sync((): unknown => require('@/assets/catalog/exercises.json')).pipe(
    Effect.flatMap(decodePayload),
    Effect.mapError(cause => new CatalogNotInstalled({ cause })),
  ),
});
