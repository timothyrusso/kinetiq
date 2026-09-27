import { Effect, Fiber, Option, SynchronizedRef } from 'effect';

/**
 * `effect`, shared by whoever runs it while it runs: the first caller starts it, every caller
 * until it settles joins the same run, and the next caller after that starts a new one. The run
 * is detached from its callers, so a caller that is interrupted leaves it running for the rest.
 */
export const singleFlight = <A, E>(effect: Effect.Effect<A, E>): Effect.Effect<Effect.Effect<A, E>> =>
  Effect.gen(function* () {
    const running = yield* SynchronizedRef.make(Option.none<Fiber.RuntimeFiber<A, E>>());
    return SynchronizedRef.modifyEffect(running, current =>
      Option.match(current, {
        onSome: fiber => Effect.succeed([fiber, current] as const),
        onNone: () =>
          effect.pipe(
            Effect.ensuring(SynchronizedRef.set(running, Option.none())),
            Effect.forkDaemon,
            Effect.map(fiber => [fiber, Option.some(fiber)] as const),
          ),
      }),
    ).pipe(Effect.flatMap(Fiber.join));
  });
