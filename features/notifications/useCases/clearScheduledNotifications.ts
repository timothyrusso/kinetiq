import { Effect } from 'effect';
import { Notifications } from '@/features/notifications/domain/services/Notifications';

/** Retracts everything this app scheduled: what the master switch does when it flips off. */
export const clearScheduledNotifications = Effect.flatMap(Notifications, notifications => notifications.cancelAll);
