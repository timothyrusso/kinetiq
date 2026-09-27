import { AppErrorBase } from '@/features/core/error';

/** The operating system does not let the app notify: refused, revoked, or no answer to read. */
export class NotificationPermissionDenied extends AppErrorBase(
  'NotificationPermissionDenied',
  'errors.notificationPermissionDenied',
) {}
