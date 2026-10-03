import { type LogContext, Logger } from '@timothyrusso/effect-core';
import { Effect } from 'effect';

/**
 * A one-off fact about the app worth finding in a log, at `info`: what a launch found, for one.
 * Like `logBackgroundFailure` it is for work with no caller to report to, and it belongs at
 * the end of that work, once, never inside a loop or a step.
 */
export const logDiagnostic = (message: string, context: LogContext): Effect.Effect<void, never, Logger> =>
  Effect.flatMap(Logger, logger => logger.info(message, context));
