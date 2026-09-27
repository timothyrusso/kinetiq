import { AppErrorBase } from '@/features/core/error/kit';

/**
 * Data from outside the app (a response, a stored row, a file) failed its Schema. `cause` is the
 * Schema's `ParseError`; the name avoids that tag, which Schema already owns.
 */
export class DecodeError extends AppErrorBase('DecodeError', 'errors.decode')<{
  readonly source: string;
}> {}
