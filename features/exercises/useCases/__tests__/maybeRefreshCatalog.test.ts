import { advanceClock } from '@timothyrusso/effect-core/testing';
import { Duration, Effect, Either, Layer } from 'effect';
import { itEffect } from '@/features/core/testing';
import { aCatalogMeta, aCatalogPayload } from '@/features/exercises/__fixtures__/builders';
import { CatalogRepository } from '@/features/exercises/domain/repositories/CatalogRepository';
import { CATALOG_MAX_AGE_MS } from '@/features/exercises/domain/utils/catalogAge';
import {
  makeCatalogRepositoryFake,
  makeCatalogSourceFake,
  serverError,
} from '@/features/exercises/useCases/__tests__/catalogFakes';
import { maybeRefreshCatalog } from '@/features/exercises/useCases/maybeRefreshCatalog';

/** A catalog generated at the epoch: the `TestClock` starts there, so its age is the clock's time. */
const installed = aCatalogMeta({ generatedAt: 0, installedAt: 0 });
const downloaded = aCatalogPayload(undefined, { generatedAt: 123 });
const readMeta = Effect.flatMap(CatalogRepository, repository => repository.readMeta);
const layer = () => Layer.mergeAll(makeCatalogRepositoryFake({ meta: installed }), makeCatalogSourceFake(downloaded));

describe('maybeRefreshCatalog', () => {
  itEffect(
    'refreshes a catalog 30 days old when online',
    Effect.gen(function* () {
      yield* advanceClock(Duration.millis(CATALOG_MAX_AGE_MS));

      expect(yield* maybeRefreshCatalog(true)).toBe(true);
      expect(yield* readMeta).toMatchObject({ generatedAt: 123, refreshedAt: CATALOG_MAX_AGE_MS });
    }),
    layer(),
  );

  itEffect(
    'leaves a catalog one millisecond younger than 30 days alone',
    Effect.gen(function* () {
      yield* advanceClock(Duration.millis(CATALOG_MAX_AGE_MS - 1));

      expect(yield* maybeRefreshCatalog(true)).toBe(false);
      expect(yield* readMeta).toEqual(installed);
    }),
    layer(),
  );

  itEffect(
    'dates the data, not the install: a snapshot generated 60 days ago and installed today is due',
    Effect.gen(function* () {
      yield* advanceClock('60 days');

      expect(yield* maybeRefreshCatalog(true)).toBe(true);
    }),
    Layer.mergeAll(
      makeCatalogRepositoryFake({ meta: aCatalogMeta({ generatedAt: 0, installedAt: 60 * 24 * 60 * 60_000 }) }),
      makeCatalogSourceFake(downloaded),
    ),
  );

  itEffect(
    'refreshes a catalog with no dates at all',
    Effect.gen(function* () {
      expect(yield* maybeRefreshCatalog(true)).toBe(true);
    }),
    Layer.mergeAll(makeCatalogRepositoryFake(), makeCatalogSourceFake(downloaded)),
  );

  itEffect(
    'sends nothing offline, however stale the catalog',
    Effect.gen(function* () {
      yield* advanceClock('90 days');

      expect(yield* maybeRefreshCatalog(false)).toBe(false);
      expect(yield* readMeta).toEqual(installed);
    }),
    Layer.mergeAll(makeCatalogRepositoryFake({ meta: installed }), makeCatalogSourceFake(downloaded, serverError())),
  );

  itEffect(
    'fails with the download failure and leaves the catalog as it was',
    Effect.gen(function* () {
      yield* advanceClock('31 days');

      const result = yield* Effect.either(maybeRefreshCatalog(true));

      expect(Either.isLeft(result) && result.left._tag).toBe('HttpError');
      expect(yield* readMeta).toEqual(installed);
    }),
    Layer.mergeAll(makeCatalogRepositoryFake({ meta: installed }), makeCatalogSourceFake(downloaded, serverError())),
  );
});
