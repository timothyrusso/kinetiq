import type { HttpErrorKind } from '@/features/core/error/domain/entities/HttpErrorKind';
import { AppErrorBase } from '@/features/core/error/kit';

/**
 * A remote call failed. `status` is the HTTP status when there was a response, and
 * `retryAfterSeconds` the server's own backoff when it sent one.
 */
export class HttpError extends AppErrorBase('HttpError', 'errors.http')<{
  readonly kind: HttpErrorKind;
  readonly status: number | null;
  readonly retryAfterSeconds: number | null;
}> {}
