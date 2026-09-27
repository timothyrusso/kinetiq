import { advanceClock } from '@timothyrusso/effect-core/testing';
import { Effect, Either } from 'effect';
import { itEffect } from '@/features/core/testing';
import { anExerciseInfo, FAKE_WGER, makeFakeWger } from '@/features/exercises/data/services/__tests__/fakeWger';
import { downloadWgerCatalog } from '@/features/exercises/data/services/downloadWgerCatalog';
import { CatalogFetchFailed } from '@/features/exercises/domain/errors/CatalogFetchFailed';

const download = (wger: ReturnType<typeof makeFakeWger>) =>
  downloadWgerCatalog(FAKE_WGER, wger.getJson, (endpoint, cause) => new CatalogFetchFailed({ endpoint, cause }));

const exerciseInfoRequests = (wger: ReturnType<typeof makeFakeWger>) =>
  wger.requested.filter(url => url.includes('exerciseinfo/'));

describe('downloadWgerCatalog', () => {
  const paged = makeFakeWger(
    Array.from({ length: 7 }, (_, i) => anExerciseInfo(i + 1)),
    3,
  );
  itEffect(
    'follows the page size the server actually returns until every row is in',
    Effect.gen(function* () {
      yield* advanceClock('42 millis');

      const payload = yield* download(paged);

      expect(payload.exercises.map(e => e.externalId)).toEqual([1, 2, 3, 4, 5, 6, 7]);
      expect(exerciseInfoRequests(paged)).toHaveLength(3);
      expect(paged.requested.some(url => url.includes('language__code'))).toBe(false);
      expect(payload.generatedAt).toBe(42);
    }),
  );

  const bilingual = makeFakeWger(
    [
      anExerciseInfo(1, {
        translations: [
          { id: 1, language: 1, name: 'Bankdrücken' },
          { id: 2, language: 13, name: 'Panca piana', description_source: '*Scendi* piano' },
          { id: 3, language: 2, name: 'Bench Press', description: '<ul><li>Lower slowly</li></ul>' },
        ],
      }),
    ],
    100,
  );
  itEffect(
    'keeps English and Italian by language id and nothing else',
    Effect.gen(function* () {
      const payload = yield* download(bilingual);

      expect(payload.exercises[0]?.translations).toEqual({
        en: { name: 'Bench Press', instructions: '• Lower slowly' },
        it: { name: 'Panca piana', instructions: 'Scendi piano' },
      });
    }),
  );

  const unshowable = makeFakeWger(
    [
      anExerciseInfo(1, { translations: [{ id: 1, language: 1, name: 'Nur Deutsch' }] }),
      anExerciseInfo(2, { category: null }),
      anExerciseInfo(3, { category: { id: 99, name: 'Gone' } }),
      anExerciseInfo(4, {
        muscles: [
          { id: 1, name: 'x' },
          { id: 50, name: 'y' },
        ],
        equipment: [{ id: 7, name: 'z' }],
      }),
      anExerciseInfo(4),
    ],
    100,
  );
  itEffect(
    'drops rows it cannot show and ids the taxonomy does not list',
    Effect.gen(function* () {
      const payload = yield* download(unshowable);

      expect(payload.exercises).toHaveLength(1);
      expect(payload.exercises[0]).toMatchObject({ externalId: 4, primaryMuscleIds: [1], equipmentIds: [] });
    }),
  );

  const dashed = makeFakeWger(
    [
      anExerciseInfo(1, {
        translations: [
          {
            id: 1,
            language: 2,
            name: 'Row \u2013 seated',
            description: '<p>Lower to 45\u201360 degrees\u2014do not flare.</p>',
          },
        ],
      }),
    ],
    100,
  );
  itEffect(
    'folds em and en dashes out of names and instructions',
    Effect.gen(function* () {
      const payload = yield* download(dashed);

      expect(payload.exercises[0]?.translations.en).toEqual({
        name: 'Row: seated',
        instructions: 'Lower to 45-60 degrees: do not flare.',
      });
    }),
  );

  const media = makeFakeWger(
    [
      anExerciseInfo(1, {
        images: [
          { image: 'first.png', is_main: false },
          { image: 'main.png', is_main: true, thumbnails: { small: 'main-small.png', medium: 'main-medium.png' } },
        ],
        videos: [{ video: 'clip.mp4', is_main: true, codec: 'hevc' }],
      }),
    ],
    100,
  );
  itEffect(
    'picks the main image and its thumbnails, and leaves out a video Android may not decode',
    Effect.gen(function* () {
      const payload = yield* download(media);

      expect(payload.exercises[0]).toMatchObject({
        imageUrl: 'main-medium.png',
        thumbnailUrl: 'main-small.png',
        videoUrl: null,
      });
    }),
  );

  const taxonomy = makeFakeWger([anExerciseInfo(1)], 100);
  itEffect(
    'sorts the taxonomy by id and maps muscles to both names',
    Effect.gen(function* () {
      const payload = yield* download(taxonomy);

      expect(payload.categories).toEqual([
        { id: 1, name: 'Chest' },
        { id: 2, name: 'Legs' },
      ]);
      expect(payload.muscles).toEqual([{ id: 1, name: 'Pectoralis major', nameEn: 'Chest', isFront: true }]);
    }),
  );

  const failing = makeFakeWger([anExerciseInfo(1), anExerciseInfo(2), anExerciseInfo(3)], 2, url =>
    url.includes('offset=2'),
  );
  itEffect(
    'fails with the transport failure when a page fails, and produces no payload',
    Effect.gen(function* () {
      const result = yield* Effect.either(download(failing));

      expect(Either.isLeft(result) && result.left._tag).toBe('HttpError');
    }),
  );

  const malformed = makeFakeWger([{ id: 'not a number' }], 100);
  itEffect(
    'fails with CatalogFetchFailed naming the endpoint when a response is not the shape it reads',
    Effect.gen(function* () {
      const result = yield* Effect.either(download(malformed));

      expect(Either.isLeft(result) && result.left).toMatchObject({
        _tag: 'CatalogFetchFailed',
        endpoint: 'exerciseinfo/',
      });
    }),
  );
});
