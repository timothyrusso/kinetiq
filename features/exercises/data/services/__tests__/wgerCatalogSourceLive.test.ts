import { Effect, Either, Layer } from 'effect';
import { AppConfig } from '@/features/core/config';
import { itEffect } from '@/features/core/testing';
import { anExerciseInfo, FAKE_WGER, makeFakeWger } from '@/features/exercises/data/services/__tests__/fakeWger';
import { makeWgerCatalogSource } from '@/features/exercises/data/services/wgerCatalogSourceLive';
import { CatalogSource } from '@/features/exercises/domain/services/CatalogSource';

const ROWS = [anExerciseInfo(1), anExerciseInfo(2), anExerciseInfo(3)];

const layerFor = (wger: ReturnType<typeof makeFakeWger>) =>
  makeWgerCatalogSource(wger.fetchImpl).pipe(Layer.provide(AppConfig.layerOf({ wgerBaseUrl: FAKE_WGER })));

const exerciseInfoRequests = (wger: ReturnType<typeof makeFakeWger>) =>
  wger.requested.filter(url => url.includes('exerciseinfo/'));

describe('WgerCatalogSourceLive', () => {
  const wger = makeFakeWger(ROWS, 2);
  itEffect(
    'downloads the catalog under the configured base URL',
    Effect.gen(function* () {
      const payload = yield* (yield* CatalogSource).fetch;

      expect(payload.exercises.map(e => e.id)).toEqual(['wger:1', 'wger:2', 'wger:3']);
      expect(wger.requested.every(url => url.startsWith(FAKE_WGER))).toBe(true);
    }),
    layerFor(wger),
  );

  const shared = makeFakeWger(ROWS, 2);
  itEffect(
    'shares one download between every caller while it runs',
    Effect.gen(function* () {
      const source = yield* CatalogSource;

      const payloads = yield* Effect.all([source.fetch, source.fetch, source.fetch], { concurrency: 'unbounded' });

      expect(payloads.map(p => p.exercises.length)).toEqual([3, 3, 3]);
      // NOTE: three rows at two per page: two pages, requested once.
      expect(exerciseInfoRequests(shared)).toHaveLength(2);
    }),
    layerFor(shared),
  );

  const again = makeFakeWger(ROWS, 2);
  itEffect(
    'starts a new download, from the first page, once the last one has settled',
    Effect.gen(function* () {
      const source = yield* CatalogSource;

      yield* source.fetch;
      yield* source.fetch;

      expect(exerciseInfoRequests(again)).toHaveLength(4);
      expect(exerciseInfoRequests(again)[2]).toContain('offset=0');
    }),
    layerFor(again),
  );

  const broken = makeFakeWger(ROWS, 2, url => url.includes('offset=2'));
  itEffect(
    'fails the download when a page fails, and the next attempt starts from the first page',
    Effect.gen(function* () {
      const source = yield* CatalogSource;

      const result = yield* Effect.either(source.fetch);
      yield* Effect.either(source.fetch);

      expect(Either.isLeft(result) && result.left).toMatchObject({ _tag: 'HttpError', kind: 'not-found' });
      expect(exerciseInfoRequests(broken)[2]).toContain('offset=0');
    }),
    layerFor(broken),
  );
});
