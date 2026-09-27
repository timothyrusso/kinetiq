import { AppErrorBase } from '@/features/core/error';

/**
 * The workout in progress could not be written to disk. The session carries on in memory and the
 * screen says it is not being saved: dropping reps quietly would be the worst outcome.
 */
export class SessionPersistFailed extends AppErrorBase('SessionPersistFailed', 'errors.sessionPersistFailed')<{
  readonly sessionId: string;
}> {}
