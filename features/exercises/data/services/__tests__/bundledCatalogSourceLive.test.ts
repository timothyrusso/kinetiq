import { Effect } from 'effect';
import { itEffect } from '@/features/core/testing';
import { BundledCatalogSourceLive } from '@/features/exercises/data/services/bundledCatalogSourceLive';
import { BundledCatalog } from '@/features/exercises/domain/services/BundledCatalog';

describe('BundledCatalogSourceLive', () => {
  itEffect(
    'loads the committed snapshot as a format 1 catalog of at least 800 exercises',
    Effect.gen(function* () {
      const payload = yield* (yield* BundledCatalog).load;

      expect(payload.formatVersion).toBe(1);
      expect(payload.source).toBe('wger');
      expect(payload.exercises.length).toBeGreaterThanOrEqual(800);
      expect(payload.categories.length).toBeGreaterThan(0);
    }),
    BundledCatalogSourceLive,
  );
});
