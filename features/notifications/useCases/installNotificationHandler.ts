import { Effect } from 'effect';
import { Notifications } from '@/features/notifications/domain/services/Notifications';

/**
 * Shows a notification that arrives while the app is open: without it the rest timer would go
 * quiet exactly when the user is most likely looking at the phone. Install it before anything is
 * scheduled.
 */
export const installNotificationHandler = Effect.flatMap(Notifications, notifications => notifications.installHandler);
