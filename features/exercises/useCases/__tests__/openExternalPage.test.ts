import { Effect, Either, Layer } from 'effect';
import { UnexpectedError } from '@/features/core/error';
import { itEffect } from '@/features/core/testing';
import { ExternalPages } from '@/features/exercises/domain/services/ExternalPages';
import { openExternalPage } from '@/features/exercises/useCases/openExternalPage';

const URL = 'https://wger.de/en/exercise/73/view';

describe('openExternalPage', () => {
  itEffect(
    'hands the page to the system',
    Effect.gen(function* () {
      yield* openExternalPage(URL);

      expect(opened).toEqual([URL]);
    }),
    pagesFake(),
  );

  itEffect(
    'fails with UnexpectedError when the device refuses the link, opening nothing',
    Effect.gen(function* () {
      const result = yield* Effect.either(openExternalPage(URL));

      expect(Either.isLeft(result) && result.left._tag).toBe('UnexpectedError');
      expect(opened).toEqual([]);
    }),
    pagesFake({ refuses: true }),
  );
});

const opened: string[] = [];

beforeEach(() => {
  opened.length = 0;
});

function pagesFake({ refuses = false }: { readonly refuses?: boolean } = {}) {
  return Layer.succeed(ExternalPages, {
    open: url =>
      refuses
        ? Effect.fail(new UnexpectedError({ cause: 'no handler' }))
        : Effect.sync(() => {
            opened.push(url);
          }),
  });
}
