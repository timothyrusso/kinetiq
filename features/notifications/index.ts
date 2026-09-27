import type { FeatureTier } from '@timothyrusso/arch-rules';

/**
 * @public Read by the architecture rules, which build the tier graph from it. Tier 2, not 1: the
 * notifications screen and the permission read edit the user's settings (`notificationsEnabled`,
 * the reminder, `notificationsGranted`), so this feature sits above `settings`, not beside it.
 */
export const FEATURE_TIER: FeatureTier = 2;

export { NotificationsLive } from '@/features/notifications/di/layer';
/** The device cannot say, or says no: what reading the permission fails with. */
export { NotificationPermissionDenied } from '@/features/notifications/domain/errors/NotificationErrors';
/** The device's notifications, for the launch: the foreground handler and the permission read. */
export { Notifications } from '@/features/notifications/domain/services/Notifications';
/** The weekly reminder, reconciled by the launch and on every return to the foreground. */
export { TrainingReminder } from '@/features/notifications/domain/services/TrainingReminder';
export { useRestAlert } from '@/features/notifications/facades/useRestAlert';
