import { Effect, Either, Layer } from 'effect';
import { UnexpectedError } from '@/features/core/error';
import { itEffect } from '@/features/core/testing';
import { ScreenWake } from '@/features/workouts/domain/services/ScreenWake';
import { setScreenAwake } from '@/features/workouts/useCases/setScreenAwake';

const screen = { awake: false };

beforeEach(() => {
  screen.awake = false;
});

const wakeFake = ({ refuses = false }: { readonly refuses?: boolean } = {}) =>
  Layer.succeed(ScreenWake, {
    keepOn: refuses
      ? Effect.fail(new UnexpectedError({ cause: 'no keep-awake' }))
      : Effect.sync(() => {
          screen.awake = true;
        }),
    release: Effect.sync(() => {
      screen.awake = false;
    }),
  });

describe('setScreenAwake', () => {
  itEffect(
    'keeps the screen on',
    Effect.gen(function* () {
      yield* setScreenAwake(true);

      expect(screen.awake).toBe(true);
    }),
    wakeFake(),
  );

  itEffect(
    'lets the screen sleep again',
    Effect.gen(function* () {
      yield* setScreenAwake(true);
      yield* setScreenAwake(false);

      expect(screen.awake).toBe(false);
    }),
    wakeFake(),
  );

  itEffect(
    'fails with UnexpectedError when the device refuses, leaving the screen as it was',
    Effect.gen(function* () {
      const result = yield* Effect.either(setScreenAwake(true));

      expect(Either.isLeft(result) && result.left._tag).toBe('UnexpectedError');
      expect(screen.awake).toBe(false);
    }),
    wakeFake({ refuses: true }),
  );
});
