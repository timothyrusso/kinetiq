import { Effect, Layer } from 'effect';
import {
  AndroidImportance,
  cancelAllScheduledNotificationsAsync,
  cancelScheduledNotificationAsync,
  getPermissionsAsync,
  type NotificationTriggerInput,
  PermissionStatus,
  requestPermissionsAsync,
  SchedulableTriggerInputTypes,
  scheduleNotificationAsync,
  setNotificationChannelAsync,
  setNotificationHandler,
} from 'expo-notifications';
import { Linking, Platform } from 'react-native';
import { toAppError } from '@/features/core/error';
import { tr } from '@/features/core/translations';
import type { NotificationTrigger } from '@/features/notifications/domain/entities/NotificationRequest';
import {
  NotificationPermissionDenied,
  NotificationScheduleFailed,
} from '@/features/notifications/domain/errors/NotificationErrors';
import { Notifications } from '@/features/notifications/domain/services/Notifications';

/** Matches the `defaultChannel` in app.json (the Android notification channel). */
const CHANNEL_ID = 'training';

/**
 * The trigger as expo-notifications takes it. `channelId` belongs on the trigger, not the
 * content: on Android it picks the channel the notification is posted to.
 *
 * On Android 12+ expo-notifications sets an exact alarm only when `canScheduleExactAlarms()` is
 * true, and an inexact one (up to a minute or more late) otherwise. `USE_EXACT_ALARM` in app.json
 * grants it on Android 13+, `SCHEDULE_EXACT_ALARM` on Android 12; without either the rest alert
 * still fires, only late (#123).
 */
function toTriggerInput(trigger: NotificationTrigger): NotificationTriggerInput | null {
  if (trigger === null) return null;
  return trigger.kind === 'afterSeconds'
    ? { type: SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: trigger.seconds, channelId: CHANNEL_ID }
    : { type: SchedulableTriggerInputTypes.DATE, date: trigger.date, channelId: CHANNEL_ID };
}

/** Local notifications through expo-notifications. */
export const NotificationsDeviceLive = Layer.sync(Notifications, () => {
  let channelReady = Platform.OS !== 'android';
  let handlerInstalled = false;

  // NOTE: Android 8+ needs a channel before anything can post. Created lazily on first use, so
  // startup pays no extra native call; `training` is the channel the plugin declares, so the icon
  // and tint from app.json apply.
  const ensureChannel = Effect.suspend(() =>
    channelReady
      ? Effect.void
      : Effect.tryPromise(() =>
          setNotificationChannelAsync(CHANNEL_ID, {
            name: tr('push.channel'),
            description: 'Rest-timer alerts and training reminders.',
            importance: AndroidImportance.HIGH,
            vibrationPattern: [0, 250, 250, 250],
            lightColor: '#C6F24E',
          }),
        ).pipe(
          // NOTE: a channel that cannot be configured still exists by default, so posting goes on.
          Effect.ignore,
          Effect.ensuring(
            Effect.sync(() => {
              channelReady = true;
            }),
          ),
        ),
  );

  // NOTE: `read` is called with no arguments, never passed as `try` itself: Effect.tryPromise hands
  // an AbortSignal to a `try` that declares a parameter, `requestPermissionsAsync` would take it as
  // the permissions to ask for, and iOS would never show the prompt.
  const readPermission = (read: typeof getPermissionsAsync) =>
    Effect.tryPromise({ try: () => read(), catch: cause => new NotificationPermissionDenied({ cause }) }).pipe(
      Effect.map(status => ({
        granted: status.granted,
        canAsk: status.status === PermissionStatus.UNDETERMINED && status.canAskAgain,
      })),
    );

  return {
    permission: readPermission(getPermissionsAsync),
    requestPermission: readPermission(requestPermissionsAsync),
    openSettings: Effect.tryPromise({ try: () => Linking.openSettings(), catch: cause => toAppError(cause) }),
    schedule: request =>
      Effect.zipRight(
        ensureChannel,
        Effect.tryPromise({
          try: () =>
            scheduleNotificationAsync({
              content: { sound: 'default', ...request.content },
              trigger: toTriggerInput(request.trigger),
            }),
          catch: cause => new NotificationScheduleFailed({ operation: 'schedule', cause }),
        }),
      ),
    cancel: identifier =>
      Platform.OS === 'web'
        ? Effect.void
        : Effect.tryPromise({
            try: () => cancelScheduledNotificationAsync(identifier),
            catch: cause => new NotificationScheduleFailed({ operation: 'cancel', cause }),
          }),
    cancelAll: Effect.tryPromise({
      try: () => cancelAllScheduledNotificationsAsync(),
      catch: cause => new NotificationScheduleFailed({ operation: 'cancelAll', cause }),
    }),
    installHandler: Effect.suspend(() =>
      handlerInstalled
        ? Effect.void
        : Effect.try({
            try: () => {
              handlerInstalled = true;
              setNotificationHandler({
                handleNotification: async () => ({
                  shouldShowAlert: true,
                  shouldPlaySound: true,
                  shouldSetBadge: false,
                  shouldShowBanner: true,
                  shouldShowList: true,
                }),
              });
            },
            catch: cause => new NotificationScheduleFailed({ operation: 'installHandler', cause }),
          }),
    ),
  };
});
