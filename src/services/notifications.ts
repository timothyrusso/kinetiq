/**
 * Local notifications: the rest-timer alert and the weekly training reminder.
 *
 * Everything about permissions lives here, and the golden rule is that a
 * denial must degrade, never block. The rest timer is a countdown in the app, * it runs on a deadline stored in the session, so it completes and reports zero
 * whether or not a notification ever arrives. Notifications make it better
 * (you can put the phone down), not required.
 *
 * Two further decisions worth stating:
 * - The reminder is *re-scheduled* rather than registered with a recurrence
 *   rule. expo-notifications can repeat a trigger, but iOS gives no way to
 *   observe whether a scheduled notification actually fired, so a repeating
 *   trigger and a settings change can drift. Scheduling the next single
 *   occurrence and recomputing it on launch, on app foreground, and on every
 *   settings write keeps "what is scheduled" equal to "what the user asked for"
 *   with no reconciliation step.
 * - Everything is best-effort. Each entry point returns a small result object
 *   instead of throwing: a device with notifications off is a normal state, not
 *   an exceptional one.
 */
import { Platform } from 'react-native';
import {
  AndroidImportance,
  cancelAllScheduledNotificationsAsync,
  cancelScheduledNotificationAsync,
  getPermissionsAsync,
  requestPermissionsAsync,
  SchedulableTriggerInputTypes,
  scheduleNotificationAsync,
  setNotificationChannelAsync,
  setNotificationHandler,
  type NotificationContentInput,
  type NotificationTriggerInput,
} from 'expo-notifications';
import type { ReminderSettings } from '@/settings';
import { tr } from '@/i18n/tr';

/** Matches the `defaultChannel` in app.json (Android notification channel). */
const CHANNEL_ID = 'training';

export type NotificationPermission = { granted: boolean; ios: boolean };

let channelReady = false;

/**
 * Android 8+ needs a channel before anything can post. Creating it lazily on
 * first use keeps startup free of an extra native call, and `training` is the
 * channel the plugin already declares, so the icon and tint from app.json
 * apply. iOS ignores this.
 */
async function ensureChannel(): Promise<void> {
  if (channelReady || Platform.OS !== 'android') {
    channelReady = true;
    return;
  }
  try {
    await setNotificationChannelAsync(CHANNEL_ID, {
      name: tr('push.channel'),
      description: 'Rest-timer alerts and training reminders.',
      importance: AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#C6F24E',
    });
  } catch {
    // A channel we cannot configure still exists by default; posting works.
  }
  channelReady = true;
}

export async function readNotificationPermission(): Promise<NotificationPermission> {
  try {
    const status = await getPermissionsAsync();
    return { granted: status.granted, ios: Platform.OS === 'ios' };
  } catch {
    return { granted: false, ios: Platform.OS === 'ios' };
  }
}

/**
 * Asks the system, once. Callers must be prepared for `granted: false` and keep
 * the feature working: see the module header.
 */
export async function requestNotificationPermission(): Promise<NotificationPermission> {
  try {
    const status = await requestPermissionsAsync();
    return { granted: status.granted, ios: Platform.OS === 'ios' };
  } catch {
    return { granted: false, ios: Platform.OS === 'ios' };
  }
}

/** Stamps the channel onto whichever trigger shape we were given. */
function withChannel(trigger: NotificationTriggerInput | null): NotificationTriggerInput | null {
  return trigger ? { ...trigger, channelId: CHANNEL_ID } : null;
}

/**
 * Posts a notification and hands back the identifier the scheduler assigned, or
 * `null` when nothing was posted (permission denied, or the native call refused).
 *
 * Returning the id is not decoration. expo-notifications cannot cancel by tag, so
 * `cancelAllScheduledNotificationsAsync` is the only blunt instrument: and using it
 * to retract a rest-timer alert would also delete the weekly training reminder. The
 * id is the only handle there is to undo exactly one scheduled notification.
 */
async function post(
  content: NotificationContentInput,
  trigger: NotificationTriggerInput | null,
): Promise<string | null> {
  const permission = await readNotificationPermission();
  if (!permission.granted) return null;
  await ensureChannel();
  try {
    // `channelId` belongs on the trigger, not the content: on Android it picks
    // the channel the notification is posted to, and content has no such field.
    const identifier = await scheduleNotificationAsync({
      content: { sound: 'default', ...content },
      trigger: withChannel(trigger),
    });
    return identifier ?? null;
  } catch {
    return null;
  }
}

/**
 * Arm a rest-timer alert.
 *
 * `delaySeconds` must be the **remaining** seconds, not the rest's configured length:
 * `TIME_INTERVAL` counts from now, so re-arming a rest that already ran 40 of its 90
 * seconds with `90` would push the alert a minute and a half into the future. That is also
 * why the caller arms at the *start* of the rest rather than when the timer expires: by
 * then the app is foregrounded and ticking, and an alert nobody needed would fire.
 *
 * Returns the scheduled identifier, or `null` when nothing was posted. Callers keep the id
 * so an early next set can retract exactly this alert; see `cancelScheduledNotification`.
 */
export async function notifyRestComplete(
  exerciseName: string,
  nextLabel: string,
  delaySeconds: number,
): Promise<string | null> {
  const seconds = Math.max(1, Math.round(delaySeconds));
  return post(
    {
      title: tr('push.restComplete'),
      body:
        nextLabel.length > 0
          ? tr('push.restNext', { name: exerciseName, next: nextLabel })
          : tr('push.restLast', { name: exerciseName }),
    },
    { type: SchedulableTriggerInputTypes.TIME_INTERVAL, seconds },
  );
}

/**
 * A single immediate alert with honest "this is a test" copy, for the settings screen that
 * offers to prove delivery works.
 *
 * Deliberately its own function rather than a call to `notifyRestComplete`: that one builds a
 * body about the next exercise, so a test built on it reads "Test alert is done: you are
 * finished here", which is worse than no test at all. Immediate (a `null` trigger), so there
 * is nothing to retract and no identifier to keep.
 */
export async function notifySettingsTest(): Promise<string | null> {
  return post(
    {
      title: tr('push.testTitle'),
      body: tr('push.testBody'),
    },
    null,
  );
}

/**
 * Retract one scheduled notification by the identifier `post` handed back.
 *
 * This exists because expo-notifications cannot cancel by tag or by purpose, and
 * `cancelAllScheduledNotificationsAsync` would take the weekly training reminder down with
 * the rest alert. That blunt instrument is what makes the identifier load-bearing: without
 * it, skipping a rest could not silence the buzz without also unpublishing a reminder the
 * user asked for.
 *
 * Never throws, and a `null` argument is a no-op: which is what "nothing was armed" looks
 * like coming out of `notifyRestComplete`.
 */
export async function cancelScheduledNotification(identifier: string | null): Promise<void> {
  if (identifier === null || Platform.OS === 'web') return;
  try {
    await cancelScheduledNotificationAsync(identifier);
  } catch {
    // Either it already fired or it was never scheduled. Both are the outcome we wanted.
  }
}

/**
 * The next occurrence of the reminder schedule, as a Date, or null when the
 * schedule has no future slot (which cannot happen with a non-empty day set,
 * but the type stays honest).
 *
 * `minuteOfDay` is interpreted in *device-local* time, and the trigger is a
 * local Date, which means the reminder follows the user across time zones
 * rather than firing at 3 a.m. because they flew east. That is the behaviour a
 * training reminder wants.
 */
function nextReminderDate(reminder: ReminderSettings, now = new Date()): Date | null {
  if (!reminder.enabled || reminder.days.length === 0) return null;
  const hour = Math.floor(reminder.minuteOfDay / 60);
  const minute = reminder.minuteOfDay % 60;

  for (let offset = 0; offset < 8; offset += 1) {
    const candidate = new Date(now);
    candidate.setDate(now.getDate() + offset);
    candidate.setHours(hour, minute, 0, 0);
    // getDay(): 0 = Sunday. ISO weekdays are 1 = Monday … 7 = Sunday.
    const iso = candidate.getDay() === 0 ? 7 : candidate.getDay();
    if (reminder.days.includes(iso) && candidate.getTime() > now.getTime()) {
      return candidate;
    }
  }
  return null;
}

export type ReminderSyncResult = { scheduled: boolean; nextDate: Date | null };

/**
 * Make the actually-scheduled reminder match the settings. Cheap enough to call
 * on every foreground and on every settings change: it cancels one notification
 * and schedules at most one.
 */
export async function syncTrainingReminder(
  reminder: ReminderSettings,
  enabled: boolean,
): Promise<ReminderSyncResult> {
  try {
    await cancelAllScheduledNotificationsAsync();
  } catch {
    // Nothing to cancel, or the API is unavailable on this device.
  }
  if (!enabled || !reminder.enabled) return { scheduled: false, nextDate: null };

  const next = nextReminderDate(reminder);
  if (!next) return { scheduled: false, nextDate: null };

  const permission = await readNotificationPermission();
  if (!permission.granted) return { scheduled: false, nextDate: null };

  const identifier = await post(
    {
      title: tr('push.reminderTitle'),
      body: tr('push.reminderBody'),
      badge: 1,
    },
    { type: SchedulableTriggerInputTypes.DATE, date: next },
  );
  // The reminder's own identifier is deliberately not returned: it is not something the
  // caller can act on, and the cancellation above is what keeps at most one of these
  // alive. That blunt cancellation also sweeps an armed rest alert if one is in flight
  // when the app comes back to the foreground: a missed buzz, in a situation where the
  // user has just unlocked their phone and can see the timer. Accepted, because the
  // alternative is a scheduler that can leave two reminders behind.
  return { scheduled: identifier !== null, nextDate: next };
}

/** Clears everything this app scheduled: used when the master switch flips off. */
export async function clearScheduledNotifications(): Promise<void> {
  try {
    await cancelAllScheduledNotificationsAsync();
  } catch {
    // Already clear.
  }
}

let handlerInstalled = false;

/**
 * A notification that arrives while the app is open is dropped unless a handler
 * says what to do with it: so without this, the rest timer would go quiet
 * exactly when the user is most likely looking at their phone, mid-set.
 *
 * Announcing everything in the foreground is right here: a rest timer ending
 * while the app is backgrounded-but-alive is still "foreground" to the OS, and
 * that is the case the feature exists for.
 */
export function installNotificationHandler(): void {
  if (handlerInstalled) return;
  handlerInstalled = true;
  try {
    setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
        shouldShowBanner: true,
        shouldShowList: true,
      }),
    });
  } catch {
    // A device without the native module simply never delivers; nothing else
    // in the app depends on this having succeeded.
  }
}
