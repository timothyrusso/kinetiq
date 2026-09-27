import { HttpError } from '@/features/core/error/domain/errors/HttpError';
import { OfflineError } from '@/features/core/error/domain/errors/OfflineError';

/** True when a failure is really "there is no network", for the offline states. */
export function isOfflineFailure(error: unknown): boolean {
  return error instanceof OfflineError || (error instanceof HttpError && error.kind === 'offline');
}
