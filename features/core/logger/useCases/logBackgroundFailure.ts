import { Logger } from '@timothyrusso/effect-core';
import { Cause, Effect } from 'effect';

/**
 * The boundary of work nobody awaits (a background refresh, a watch sync fired by a native
 * event): it has no caller to hand a failure to, so the failure is logged here, once, as the
 * query hooks log theirs, and the work ends. Wrap the whole task, never a step inside it.
 */
export const logBackgroundFailure =
  (task: string) =>
  <A, E, R>(effect: Effect.Effect<A, E, R>): Effect.Effect<void, never, R | Logger> =>
    effect.pipe(
      Effect.asVoid,
      Effect.catchAllCause(cause =>
        Cause.isInterruptedOnly(cause)
          ? Effect.void
          : Effect.flatMap(Logger, logger => logger.warn(`${task} failed`, { cause: Cause.squash(cause) })),
      ),
    );
