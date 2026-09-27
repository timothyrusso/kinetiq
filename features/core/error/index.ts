import type { FeatureTier } from '@timothyrusso/arch-rules';

export const FEATURE_TIER: FeatureTier = 0;

export type { AppError, AppErrorRegistry } from '@/features/core/error/appError';
export type { HttpErrorKind } from '@/features/core/error/domain/entities/HttpErrorKind';
export { DecodeError } from '@/features/core/error/domain/errors/DecodeError';
export { HttpError } from '@/features/core/error/domain/errors/HttpError';
export { OfflineError } from '@/features/core/error/domain/errors/OfflineError';
export { HTTP_RETRY_BUDGET, httpRetryDelayMs } from '@/features/core/error/domain/utils/httpRetry';
export { isOfflineFailure } from '@/features/core/error/domain/utils/isOfflineFailure';
export { useErrorMessage } from '@/features/core/error/hooks/useErrorMessage';
export {
  AppErrorBase,
  ConfigError,
  isAppError,
  SqlError,
  toAppError,
  UnexpectedError,
} from '@/features/core/error/kit';
export { errorTagToMessageKey } from '@/features/core/error/mappers/errorTagToMessageKey';
