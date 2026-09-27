import { Effect, Layer, TestClock } from 'effect';
import { resetAllStores } from '@/features/core/state';
import { itEffect } from '@/features/core/testing';
import { aSession } from '@/features/workouts/__fixtures__/builders';
import { SessionEngineLive } from '@/features/workouts/data/services/sessionEngineLive';
import { useSessionStore } from '@/features/workouts/state/sessionStore';
import type { FakeFailures, FakeWorkoutsDb } from '@/features/workouts/useCases/__tests__/workoutFakes';
import { makeFakeWorkoutsDb, makeWorkoutsFake } from '@/features/workouts/useCases/__tests__/workoutFakes';

const NOW = 2_000_000_000_000;
const store = () => useSessionStore.getState();

/** The engine over the fakes, with the store it drives back at its start. */
const engine = (db: FakeWorkoutsDb, failing: FakeFailures = {}) =>
  SessionEngineLive.pipe(Layer.provide(makeWorkoutsFake(db, failing)));

/** Lets the engine's fibers take what the store queued. */
const settle = Effect.repeatN(Effect.yieldNow(), 20);

/** Starts the builder's session at the test clock's `NOW`. */
const startAtNow = Effect.gen(function* () {
  yield* TestClock.setTime(NOW);
  store().start(aSession({ elapsedSeconds: 0 }), NOW);
  yield* settle;
});

beforeEach(() => resetAllStores());

describe('SessionEngineLive persistence', () => {
  const written = makeFakeWorkoutsDb();
  itEffect(
    'writes every change the store queues, so the disk holds the session on screen',
    Effect.gen(function* () {
      yield* startAtNow;

      store().toggleSet(1, 0, NOW + 1);
      store().focus(1, NOW + 2);
      yield* settle;

      expect(written.sessions.get(aSession().id)).toEqual(store().session);
      expect(store().persistFailed).toBe(false);
    }),
    engine(written),
  );

  const skipped = makeFakeWorkoutsDb();
  itEffect(
    'clears the rest on disk when the rest is skipped',
    Effect.gen(function* () {
      yield* startAtNow;
      store().setRest(90, NOW + 1);
      yield* settle;

      store().clearRest(NOW + 2);
      yield* settle;

      expect(skipped.sessions.get(aSession().id)).toMatchObject({ restEndsAt: null, restDurationSeconds: null });
    }),
    engine(skipped),
  );

  const refused = makeFakeWorkoutsDb();
  itEffect(
    'flags the store when a write fails and keeps the workout going in memory',
    Effect.gen(function* () {
      yield* startAtNow;

      store().toggleSet(1, 0, NOW + 1);
      yield* settle;

      expect(store().persistFailed).toBe(true);
      expect(store().session?.entries[1]?.sets[0]?.completed).toBe(true);
      expect(refused.sessions.size).toBe(0);
    }),
    engine(refused, { sessions: 'save' }),
  );

  const recovered = makeFakeWorkoutsDb();
  itEffect(
    'keeps writing the changes after a failed one',
    Effect.gen(function* () {
      yield* startAtNow;
      store().markPersistFailed();

      store().pause(NOW + 1);
      yield* settle;

      expect(recovered.sessions.get(aSession().id)?.status).toBe('paused');
    }),
    engine(recovered),
  );
});

describe('SessionEngineLive clock', () => {
  itEffect(
    'banks a second every second while the workout runs',
    Effect.gen(function* () {
      yield* startAtNow;

      yield* TestClock.adjust('3 seconds');
      yield* settle;

      expect(store().session?.elapsedSeconds).toBe(3);
      expect(store().tick).toBe(3);
    }),
    engine(makeFakeWorkoutsDb()),
  );

  itEffect(
    'stops counting while the workout is paused and starts again on resume',
    Effect.gen(function* () {
      yield* startAtNow;
      yield* TestClock.adjust('2 seconds');
      store().pause(NOW + 2_000);
      yield* settle;

      yield* TestClock.adjust('10 seconds');
      store().resume(NOW + 12_000);
      yield* settle;
      yield* TestClock.adjust('1 second');
      yield* settle;

      expect(store().session?.elapsedSeconds).toBe(3);
    }),
    engine(makeFakeWorkoutsDb()),
  );
});
