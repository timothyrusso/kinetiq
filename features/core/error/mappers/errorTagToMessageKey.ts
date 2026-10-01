import { defineAppErrors } from '@timothyrusso/effect-core';
import type { AppError } from '@/features/core/error/appError';
import type { TKey } from '@/features/core/translations';

const appErrors = defineAppErrors<AppError>();

/**
 * The catalog key of every error tag. A tag missing here, or a key that is not a tag, fails to
 * compile; each key equals the class's own `messageKey`.
 */
export const errorTagToMessageKey = appErrors.assertExhaustiveMessageKeys<TKey>({
  UnexpectedError: 'errors.unexpected',
  SqlError: 'errors.sql',
  ConfigError: 'errors.config',
  OfflineError: 'errors.offline',
  HttpError: 'errors.http',
  DecodeError: 'errors.decode',
  NotificationPermissionDenied: 'errors.notificationPermissionDenied',
  NotificationScheduleFailed: 'errors.notificationScheduleFailed',
  WatchUnavailable: 'errors.watchUnavailable',
  CatalogNotInstalled: 'errors.catalogNotInstalled',
  RoutineNotFound: 'errors.routineNotFound',
  RoutineNameTaken: 'errors.routineNameTaken',
  SessionAlreadyActive: 'errors.sessionAlreadyActive',
  NoActiveSession: 'errors.noActiveSession',
  DuplicateWorkout: 'errors.duplicateWorkout',
  SessionPersistFailed: 'errors.sessionPersistFailed',
  ActivityNotFound: 'errors.activityNotFound',
  ImportTooLarge: 'dataTransfer.errorTooLarge',
  ImportUnreadable: 'dataTransfer.errorUnreadable',
});
