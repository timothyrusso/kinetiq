import { useErrorMessage as useMappedErrorMessage } from '@timothyrusso/effect-core/react';
import type { AppError } from '@/features/core/error/appError';
import { errorTagToMessageKey } from '@/features/core/error/mappers/errorTagToMessageKey';
import { useT } from '@/features/core/translations';

/** The translated message for an app error, or `undefined` when there is none. */
export const useErrorMessage = (error: AppError | null | undefined): string | undefined => {
  const { t } = useT();
  return useMappedErrorMessage(error, errorTagToMessageKey, t);
};
