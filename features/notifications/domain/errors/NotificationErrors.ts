import { NotificationPermissionDenied } from '@/features/notifications/domain/errors/NotificationPermissionDenied';
import { NotificationScheduleFailed } from '@/features/notifications/domain/errors/NotificationScheduleFailed';

export { NotificationPermissionDenied, NotificationScheduleFailed };

declare module '@/features/core/error' {
  interface AppErrorRegistry {
    notifications: NotificationPermissionDenied | NotificationScheduleFailed;
  }
}
