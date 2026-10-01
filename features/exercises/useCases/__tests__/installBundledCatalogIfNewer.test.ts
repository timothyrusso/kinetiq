import { advanceClock } from '@timothyrusso/effect-core/testing';
import { Effect, Either, Layer } from 'effect';
import { itEffect } from '@/features/core/testing';
import { aCatalogExercise, aCatalogMeta, aCatalogPayload } from '@/features/exercises/__fixtures__/builders';
import { CatalogRepository } from '@/features/exercises/domain/repositories/CatalogRepository';
import {
  makeBundledCatalogFake,
  makeCatalogRepositoryFake,
} from '@/features/exercises/useCases/__tests__/catalogFakes';
import { installBundledCatalogIfNewer } from '@/features/exercises/useCases/installBundledCatalogIfNewer';

const dataset = (datasetVersion: number) =>
  aCatalogPayload([aCatalogExercise('squat', { en: 'Squat' }), aCatalogExercise('dips', { en: 'Dips' })], {
    datasetVersion,
  });
const readMeta = Effect.flatMap(CatalogRepository, repository => repository.readMeta);

describe('installBundledCatalogIfNewer', () => {
  const fresh = makeBundledCatalogFake(dataset(1));
  itEffect(
    'installs the bundled dataset when none is installed, stamped now',
    Effect.gen(function* () {
      yield* advanceClock('9 seconds');

      expect(yield* installBundledCatalogIfNewer).toBe(true);
      expect(yield* readMeta).toEqual({ datasetVersion: 1, installedAt: 9_000, exerciseCount: 2, formatVersion: 2 });
    }),
    Layer.mergeAll(makeCatalogRepositoryFake(), fresh.layer),
  );

  const newer = makeBundledCatalogFake(dataset(3));
  itEffect(
    'reinstalls when the bundled dataset is newer than the installed one',
    Effect.gen(function* () {
      expect(yield* installBundledCatalogIfNewer).toBe(true);
      expect(yield* readMeta).toMatchObject({ datasetVersion: 3, exerciseCount: 2 });
    }),
    Layer.mergeAll(makeCatalogRepositoryFake({ meta: aCatalogMeta({ datasetVersion: 2 }) }), newer.layer),
  );

  const same = makeBundledCatalogFake(dataset(2));
  const installed = aCatalogMeta({ datasetVersion: 2, exerciseCount: 876 });
  itEffect(
    'leaves a current catalog alone without loading the dataset',
    Effect.gen(function* () {
      expect(yield* installBundledCatalogIfNewer).toBe(false);
      expect(yield* readMeta).toEqual(installed);
      expect(same.reads.loads).toBe(0);
    }),
    Layer.mergeAll(makeCatalogRepositoryFake({ meta: installed }), same.layer),
  );

  const older = makeBundledCatalogFake(dataset(1));
  itEffect(
    'never goes back to an older bundled dataset',
    Effect.gen(function* () {
      expect(yield* installBundledCatalogIfNewer).toBe(false);
      expect(older.reads.loads).toBe(0);
    }),
    Layer.mergeAll(makeCatalogRepositoryFake({ meta: installed }), older.layer),
  );

  itEffect(
    'fails with CatalogNotInstalled when the bundled file does not decode, and writes nothing',
    Effect.gen(function* () {
      const result = yield* Effect.either(installBundledCatalogIfNewer);

      expect(Either.isLeft(result) && result.left._tag).toBe('CatalogNotInstalled');
      expect((yield* readMeta).datasetVersion).toBeNull();
    }),
    Layer.mergeAll(makeCatalogRepositoryFake(), makeBundledCatalogFake('corrupt').layer),
  );

  itEffect(
    'fails with SqlError when the write fails, leaving no install marker',
    Effect.gen(function* () {
      const result = yield* Effect.either(installBundledCatalogIfNewer);

      expect(Either.isLeft(result) && result.left._tag).toBe('SqlError');
      expect((yield* readMeta).datasetVersion).toBeNull();
    }),
    Layer.mergeAll(makeCatalogRepositoryFake({ failingWrites: true }), makeBundledCatalogFake(dataset(1)).layer),
  );
});
