import { AppErrorBase } from '@/features/core/error';

/** No workout `sessionId` is in progress: it was finished or discarded, most likely elsewhere. */
export class NoActiveSession extends AppErrorBase('NoActiveSession', 'errors.noActiveSession')<{
  readonly sessionId: string;
}> {}
