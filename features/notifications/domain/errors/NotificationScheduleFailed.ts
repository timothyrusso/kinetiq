import { AppErrorBase } from '@/features/core/error';

/** The notification scheduler refused a call: `operation` names which one. */
export class NotificationScheduleFailed extends AppErrorBase(
  'NotificationScheduleFailed',
  'errors.notificationScheduleFailed',
)<{
  readonly operation: 'schedule' | 'cancel' | 'cancelAll' | 'installHandler';
}> {}
