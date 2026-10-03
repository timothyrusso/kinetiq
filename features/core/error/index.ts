import type { FeatureTier } from '@timothyrusso/arch-rules';

export const FEATURE_TIER: FeatureTier = 0;

export type { AppError, AppErrorRegistry } from '@/features/core/error/appError';
export { DecodeError } from '@/features/core/error/domain/errors/DecodeError';
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
