import type { FeatureTier } from '@timothyrusso/arch-rules';

/**
 * @public Read by the architecture rules, which build the tier graph from it. Tier 2, not 1: the
 * notifications screen and the permission read edit the user's settings (`notificationsEnabled`,
 * the reminder, `notificationsGranted`), so this feature sits above `settings`, not beside it.
 */
export const FEATURE_TIER: FeatureTier = 2;

export { NotificationsLive } from '@/features/notifications/di/layer';
export type { NotificationPermission } from '@/features/notifications/domain/entities/NotificationPermission';
export type { ReminderSchedule } from '@/features/notifications/domain/entities/ReminderSchedule';
/** The use cases the legacy callers run through the runtime, until bootstrap and the workout screen move. */
export { armRestAlert } from '@/features/notifications/useCases/armRestAlert';
export { cancelNotification } from '@/features/notifications/useCases/cancelNotification';
export { installNotificationHandler } from '@/features/notifications/useCases/installNotificationHandler';
export { readNotificationPermission } from '@/features/notifications/useCases/readNotificationPermission';
export { syncTrainingReminder } from '@/features/notifications/useCases/syncTrainingReminder';
