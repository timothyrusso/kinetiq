import { advanceClock } from '@timothyrusso/effect-core/testing';
import { Effect, Either, Layer } from 'effect';
import { itEffect } from '@/features/core/testing';
import { aCatalogExercise, aCatalogMeta, aCatalogPayload } from '@/features/exercises/__fixtures__/builders';
import { CatalogRepository } from '@/features/exercises/domain/repositories/CatalogRepository';
import {
  makeBundledCatalogFake,
  makeCatalogRepositoryFake,
} from '@/features/exercises/useCases/__tests__/catalogFakes';
import { installBundledCatalogIfMissing } from '@/features/exercises/useCases/installBundledCatalogIfMissing';

const bundled = aCatalogPayload([aCatalogExercise(1), aCatalogExercise(2)], { generatedAt: 700 });
const readMeta = Effect.flatMap(CatalogRepository, repository => repository.readMeta);

describe('installBundledCatalogIfMissing', () => {
  itEffect(
    'installs the bundled catalog when none is installed, stamped now',
    Effect.gen(function* () {
      yield* advanceClock('9 seconds');

      expect(yield* installBundledCatalogIfMissing).toBe(true);
      expect(yield* readMeta).toEqual({
        source: 'wger',
        generatedAt: 700,
        installedAt: 9_000,
        refreshedAt: null,
        exerciseCount: 2,
        formatVersion: 1,
      });
    }),
    Layer.mergeAll(makeCatalogRepositoryFake(), makeBundledCatalogFake(bundled)),
  );

  const installed = aCatalogMeta({ installedAt: 5_000, exerciseCount: 900 });
  itEffect(
    'leaves an installed catalog alone',
    Effect.gen(function* () {
      expect(yield* installBundledCatalogIfMissing).toBe(false);
      expect(yield* readMeta).toEqual(installed);
    }),
    Layer.mergeAll(makeCatalogRepositoryFake({ meta: installed }), makeBundledCatalogFake('corrupt')),
  );

  itEffect(
    'fails with CatalogNotInstalled when the bundled file does not decode, and writes nothing',
    Effect.gen(function* () {
      const result = yield* Effect.either(installBundledCatalogIfMissing);

      expect(Either.isLeft(result) && result.left._tag).toBe('CatalogNotInstalled');
      expect((yield* readMeta).installedAt).toBeNull();
    }),
    Layer.mergeAll(makeCatalogRepositoryFake(), makeBundledCatalogFake('corrupt')),
  );

  itEffect(
    'fails with SqlError when the write fails, leaving no install marker',
    Effect.gen(function* () {
      const result = yield* Effect.either(installBundledCatalogIfMissing);

      expect(Either.isLeft(result) && result.left._tag).toBe('SqlError');
      expect((yield* readMeta).installedAt).toBeNull();
    }),
    Layer.mergeAll(makeCatalogRepositoryFake({ failingWrites: true }), makeBundledCatalogFake(bundled)),
  );
});
