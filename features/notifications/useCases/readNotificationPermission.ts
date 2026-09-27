import { Effect } from 'effect';
import { Notifications } from '@/features/notifications/domain/services/Notifications';

/** The operating system's answer now: the user may have changed it in another app. */
export const readNotificationPermission = Effect.flatMap(Notifications, notifications => notifications.permission);

/** Asks the system. After a refusal iOS never shows the prompt again, and only answers. */
export const requestNotificationPermission = Effect.flatMap(
  Notifications,
  notifications => notifications.requestPermission,
);
