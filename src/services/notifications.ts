/**
 * Local notifications: the rest-timer alert and the weekly training reminder.
 *
 * Everything about permissions lives here, and the golden rule is that a
 * denial must degrade, never block. The rest timer is a countdown in the app —
 * it runs on a deadline stored in the session, so it completes and reports zero
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
      name: 'Training',
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
 * the feature working — see the module header.
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

async function post(
  content: NotificationContentInput,
  trigger: NotificationTriggerInput | null,
): Promise<boolean> {
  const permission = await readNotificationPermission();
  if (!permission.granted) return false;
  await ensureChannel();
  try {
    // `channelId` belongs on the trigger, not the content: on Android it picks
    // the channel the notification is posted to, and content has no such field.
    await scheduleNotificationAsync({
      content: { sound: 'default', ...content },
      trigger: withChannel(trigger),
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * Fire a rest-timer alert. `delaySeconds` is measured here against an absolute
 * deadline, so a backgrounded or suspended app that takes a moment to wake
 * still lands the notification rather than firing late with stale copy.
 */
export async function notifyRestComplete(
  exerciseName: string,
  nextLabel: string,
  delaySeconds: number,
): Promise<boolean> {
  const seconds = Math.max(1, Math.round(delaySeconds));
  return post(
    {
      title: 'Rest complete',
      body:
        nextLabel.length > 0
          ? `${exerciseName} is done. Next up: ${nextLabel}.`
          : `${exerciseName} is done — you are finished here.`,
    },
    { type: SchedulableTriggerInputTypes.TIME_INTERVAL, seconds },
  );
}

/** A PR deserves the one celebratory notification the app sends. */
export async function notifyPersonalRecord(exerciseName: string, detail: string): Promise<boolean> {
  return post({ title: `New record — ${exerciseName}`, body: detail }, null);
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
export function nextReminderDate(reminder: ReminderSettings, now = new Date()): Date | null {
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

  const scheduled = await post(
    {
      title: 'Time to train',
      body: 'Your session is waiting. Even a short one keeps the streak alive.',
      badge: 1,
    },
    { type: SchedulableTriggerInputTypes.DATE, date: next },
  );
  return { scheduled, nextDate: scheduled ? next : null };
}

/** Clears everything this app scheduled — used when the master switch flips off. */
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
 * says what to do with it — so without this, the rest timer would go quiet
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
