import { Layer } from 'effect';
import { NotificationsDeviceLive } from '@/features/notifications/data/services/notificationsDeviceLive';
import { TrainingReminderLive } from '@/features/notifications/di/trainingReminderLive';

/** Every Layer `notifications` provides: the device's notifications, and the reminder over them. */
export const NotificationsLive = TrainingReminderLive.pipe(Layer.provideMerge(NotificationsDeviceLive));
