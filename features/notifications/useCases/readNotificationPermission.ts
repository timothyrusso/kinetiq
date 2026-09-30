import { Effect } from 'effect';
import { Notifications } from '@/features/notifications/domain/services/Notifications';

/** The operating system's answer now: the user may have changed it in another app. */
export const readNotificationPermission = Effect.flatMap(Notifications, notifications => notifications.permission);

/** Asks the system. After a refusal iOS never shows the prompt again, and only answers. */
export const requestNotificationPermission = Effect.flatMap(
  Notifications,
  notifications => notifications.requestPermission,
);

/**
 * Asks only while the system can still show its prompt, and otherwise answers with the
 * permission as it stands: a start that finds it granted or refused asks nothing.
 */
export const askNotificationPermissionOnce = Effect.gen(function* () {
  const notifications = yield* Notifications;
  const now = yield* notifications.permission;
  return now.canAsk ? yield* notifications.requestPermission : now;
});

/** Opens the app's page in the system settings, where a refused permission is turned back on. */
export const openNotificationSettings = Effect.flatMap(Notifications, notifications => notifications.openSettings);
