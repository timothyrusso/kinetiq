import { advanceClock } from '@timothyrusso/effect-core/testing';
import { Effect, Either, Layer } from 'effect';
import { itEffect } from '@/features/core/testing';
import { aCatalogExercise, aCatalogMeta, aCatalogPayload } from '@/features/exercises/__fixtures__/builders';
import { CatalogRepository } from '@/features/exercises/domain/repositories/CatalogRepository';
import {
  makeCatalogRepositoryFake,
  makeCatalogSourceFake,
  serverError,
} from '@/features/exercises/useCases/__tests__/catalogFakes';
import { refreshCatalog } from '@/features/exercises/useCases/refreshCatalog';

const installed = aCatalogMeta({ generatedAt: 1_000, installedAt: 2_000, exerciseCount: 1 });
const downloaded = aCatalogPayload([aCatalogExercise(1), aCatalogExercise(2), aCatalogExercise(3)], {
  generatedAt: 8_000,
});
const readMeta = Effect.flatMap(CatalogRepository, repository => repository.readMeta);

describe('refreshCatalog', () => {
  itEffect(
    'swaps in the download, keeping the install date and stamping the refresh',
    Effect.gen(function* () {
      yield* advanceClock('10 seconds');

      yield* refreshCatalog;

      expect(yield* readMeta).toMatchObject({
        generatedAt: 8_000,
        installedAt: 2_000,
        refreshedAt: 10_000,
        exerciseCount: 3,
      });
    }),
    Layer.mergeAll(makeCatalogRepositoryFake({ meta: installed }), makeCatalogSourceFake(downloaded)),
  );

  itEffect(
    'fails with the download failure and leaves the installed catalog as it was',
    Effect.gen(function* () {
      const result = yield* Effect.either(refreshCatalog);

      expect(Either.isLeft(result) && result.left._tag).toBe('HttpError');
      expect(yield* readMeta).toEqual(installed);
    }),
    Layer.mergeAll(makeCatalogRepositoryFake({ meta: installed }), makeCatalogSourceFake(downloaded, serverError())),
  );
});
