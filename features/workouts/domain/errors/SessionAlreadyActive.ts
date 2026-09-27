import { AppErrorBase } from '@/features/core/error';

/** A workout is already running; starting another would replace it. */
export class SessionAlreadyActive extends AppErrorBase('SessionAlreadyActive', 'errors.sessionAlreadyActive')<{
  readonly sessionId: string;
}> {}
