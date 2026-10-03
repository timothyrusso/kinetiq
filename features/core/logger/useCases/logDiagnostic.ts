import { type LogContext, Logger } from '@timothyrusso/effect-core';
import { Effect } from 'effect';

/**
 * Logs the launch outcome, once, at `info`, at the end of `runBootstrap`: the launch has no
 * caller that reads it. It is for that one call only, which Exceptions 1 in
 * `docs/ARCHITECTURE.md` allows; any other caller needs its own Exceptions entry first.
 */
export const logDiagnostic = (message: string, context: LogContext): Effect.Effect<void, never, Logger> =>
  Effect.flatMap(Logger, logger => logger.info(message, context));
