import { Clock, Effect, Layer, Queue, Stream } from 'effect';
import type { SessionWrite } from '@/features/workouts/domain/entities/SessionWrite';
import { useSessionStore } from '@/features/workouts/state/sessionStore';
import { persistSession } from '@/features/workouts/useCases/persistSession';

/** Banks the seconds since the last tick into the session in progress. */
const tickNow = Effect.flatMap(Clock.currentTimeMillis, now =>
  Effect.sync(() => useSessionStore.getState().tickClock(now)),
);

/** A tick one second after the clock starts, and every second after that, until it stops. */
const everySecond = Stream.fromEffect(Effect.forever(Effect.zipRight(Effect.sleep('1 second'), tickNow)));

/**
 * The session store's two side effects, for as long as the runtime lives.
 *
 * Every write the store queues is made in order through `persistSession`. A failed write sets the
 * store's `persistFailed` and the session carries on in memory: the screen says it is not saving,
 * which is the whole surface of the failure, so nothing is logged here. And while the store's
 * clock runs, it ticks once a second, so a screen unmount cannot lose time.
 */
export const SessionEngineLive = Layer.scopedDiscard(
  Effect.gen(function* () {
    const writes = yield* Queue.unbounded<SessionWrite>();
    const clock = yield* Queue.unbounded<boolean>();
    const unsubscribe = useSessionStore.subscribe((state, previous) => {
      if (state.writes !== previous.writes && state.pendingWrite !== null)
        Queue.unsafeOffer(writes, state.pendingWrite);
      if (state.clockRunning !== previous.clockRunning) Queue.unsafeOffer(clock, state.clockRunning);
    });
    yield* Effect.addFinalizer(() => Effect.sync(unsubscribe));
    Queue.unsafeOffer(clock, useSessionStore.getState().clockRunning);

    yield* Stream.fromQueue(writes).pipe(
      Stream.runForEach(write =>
        persistSession(write).pipe(
          Effect.catchTag('SessionPersistFailed', () =>
            Effect.sync(() => useSessionStore.getState().markPersistFailed()),
          ),
        ),
      ),
      Effect.forkScoped,
    );

    yield* Stream.fromQueue(clock).pipe(
      Stream.changes,
      Stream.flatMap(running => (running ? everySecond : Stream.empty), { switch: true }),
      Stream.runDrain,
      Effect.forkScoped,
    );
  }),
);
