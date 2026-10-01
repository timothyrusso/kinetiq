import { Effect } from 'effect';
import { itEffect } from '@/features/core/testing';
import { BundledCatalogSourceLive } from '@/features/exercises/data/services/bundledCatalogSourceLive';
import { BundledCatalog } from '@/features/exercises/domain/services/BundledCatalog';

describe('BundledCatalogSourceLive', () => {
  itEffect(
    'loads the committed dataset, every entry decoding, at the version version.json names',
    Effect.gen(function* () {
      const bundled = yield* BundledCatalog;
      const payload = yield* bundled.load;

      expect(payload.datasetVersion).toBe(yield* bundled.version);
      expect(payload.exercises.length).toBeGreaterThanOrEqual(800);
    }),
    BundledCatalogSourceLive,
  );
});
