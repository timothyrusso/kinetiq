import type { ConfigError, SqlError, UnexpectedError } from '@timothyrusso/effect-core';
import type { DecodeError } from '@/features/core/error/domain/errors/DecodeError';
import type { HttpError } from '@/features/core/error/domain/errors/HttpError';
import type { OfflineError } from '@/features/core/error/domain/errors/OfflineError';

/**
 * Every error that can reach the UI, keyed by the feature that declares it. Each feature adds
 * `<feature>: <its error union>` here by module augmentation from its `domain/errors/index.ts`.
 */
export interface AppErrorRegistry {
  core: UnexpectedError | SqlError | ConfigError | OfflineError | HttpError | DecodeError;
}

/** The closed union of every error that can reach the UI. */
export type AppError = AppErrorRegistry[keyof AppErrorRegistry];
