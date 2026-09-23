/**
 * Notifications: the rest-timer alert, the weekly reminder, and the OS permission that
 * decides whether either of them can exist.
 *
 * ## Three switches, three different meanings
 *
 * `notificationsEnabled` is the app's own master switch. `reminder.enabled` is a schedule.
 * And `granted` is the operating system's answer, which the user set in a different app and
 * can revoke there at any time. Collapsing those into one "Notifications" toggle is the
 * common way to build this screen, and it produces the well-known bug where everything looks
 * on and nothing arrives. So the OS answer gets its own row, its own colour, and its own
 * explanation, and it is read from the device rather than from the store.
 *
 * ## Why the reminder is re-synced on every commit
 *
 * `syncTrainingReminder` rebuilds the schedule from scratch: cancel, then schedule at most
 * one DATE trigger. It is idempotent and cheap, so every change here calls it immediately
 * rather than deferring: a reminder you just configured that only appears after a restart is
 * indistinguishable from one that was never saved.
 *
 * ## The one case where it deliberately does *not* re-sync
 *
 * Cancelling means `cancelAllScheduledNotificationsAsync`, which cannot be selective:
 * expo-notifications has no cancel-by-purpose. Mid-workout, the notification that is about to
 * fire is a rest-timer alert the user is currently relying on. Re-syncing the *weekly*
 * reminder in that moment would silence the rest buzz to change a date days away, so when a
 * session is active the schedule is left alone and the screen says so in plain words. It is
 * reconciled when the session ends and on the next return to the foreground, which
 * `installAppLifecycle` already does.
 *
 * ## Denial is a supported state, everywhere
 *
 * Nothing here claims the app cannot function. The rest timer keeps counting on screen with
 * no permission at all, so permission changes what *notifies* you, not what works. That is
 * stated rather than implied, because the alternative is a settings screen that reads as
 * broken to the ~30% of users who never grant it.
 */
import { useCallback, useMemo, useState } from 'react';

import { ScreenHeader } from '@/ui/Screen';
import { SettingsList, type SettingsSection } from '@/ui/controls/SettingsList';
import { useSettings, useSettingsUpdate } from '@/settings';
import type { ReminderSettings } from '@/settings';
import { usePermissions } from '@/queries/usePermissions';
import {
  clearScheduledNotifications,
  notifySettingsTest,
  syncTrainingReminder,
} from '@/services/notifications';
import { getSessionSnapshot } from '@/workout/session';
import { haptics } from '@/services/haptics';
import { useT } from '@/i18n/useT';
import { tr } from '@/i18n/tr';
import { formatClock } from '@/utils/relativeTime';

/** A quarter-hour grid: nobody wants 18:07, and finer steps make the stepper pointless. */
const REMINDER_STEP_MINUTES = 15;
/** 23:45 is the latest slot; midnight itself belongs to the next day. */
const REMINDER_LAST_MINUTE = 24 * 60 - REMINDER_STEP_MINUTES;

/** ISO weekdays, Monday first. Their names come from `Intl`; see `dayLabel`. */
const ISO_DAYS: readonly number[] = [1, 2, 3, 4, 5, 6, 7];

/**
 * Weekday names from `Intl`, not from a table of English abbreviations.
 *
 * A hand-written `['Mon', 'Tue', ...]` would need a translated copy per locale, and would then
 * be a second opinion about weekday names that the platform already holds. The reference date
 * is an arbitrary Monday (2024-01-01 was one), so ISO day 1 maps to it and the rest follow.
 *
 * `dayName` is the full name, for a checklist row ("Monday", "lunedì"); `dayLabel` the short
 * one, for a summary line.
 */
function dayName(iso: number, locale: string): string {
  const reference = new Date(Date.UTC(2024, 0, iso, 12));
  return new Intl.DateTimeFormat(locale, { weekday: 'long', timeZone: 'UTC' }).format(reference);
}

function dayLabel(iso: number, locale: string): string {
  const reference = new Date(Date.UTC(2024, 0, iso, 12));
  return new Intl.DateTimeFormat(locale, { weekday: 'short', timeZone: 'UTC' }).format(reference);
}

export default function SettingsNotificationsScreen() {
  const { t, locale } = useT();
  const update = useSettingsUpdate();
  const { notifications, requestNotifications } = usePermissions();

  const enabled = useSettings((s) => s.notificationsEnabled);
  const reminder = useSettings((s) => s.reminder);

  /**
   * Kept in component state rather than derived, because "we did not re-sync" is a fact about
   * the moment the user tapped, not about the settings. A user who turns the reminder on
   * mid-session needs to know it is waiting; that message has to survive them reading the rest
   * of the screen.
   */
  const [deferred, setDeferred] = useState(false);
  const [granting, setGranting] = useState(false);

  /**
   * Commit settings, then make the device match them.
   *
   * Every mutation on this screen goes through here so there is exactly one place that
   * decides whether the schedule is rebuilt: the mid-session exception cannot be forgotten by
   * a control that forgot to call it.
   */
  const commit = useCallback(
    (patch: Partial<ReminderSettings> | 'clear') => {
      const nextReminder =
        patch === 'clear' ? { ...reminder, enabled: false } : { ...reminder, ...patch };
      update({ reminder: nextReminder });

      if (getSessionSnapshot().session !== null) {
        setDeferred(true);
        return;
      }
      setDeferred(false);
      void syncTrainingReminder(nextReminder, enabled).catch(() => undefined);
    },
    [enabled, reminder, update],
  );

  const toggleMaster = useCallback(
    (next: boolean) => {
      update({ notificationsEnabled: next });
      if (!next) {
        // Turning the master switch off must actually stop the alerts, not merely declare
        // that it has: the already-scheduled reminder is still in the OS otherwise.
        setDeferred(false);
        void clearScheduledNotifications().catch(() => undefined);
        return;
      }
      setDeferred(false);
      void syncTrainingReminder(reminder, true).catch(() => undefined);
    },
    [reminder, update],
  );

  const ask = useCallback(async () => {
    setGranting(true);
    const result = await requestNotifications();
    setGranting(false);
    if (result.granted) {
      haptics.success();
      void syncTrainingReminder(reminder, enabled).catch(() => undefined);
      return;
    }
    haptics.warning();
  }, [enabled, reminder, requestNotifications]);

  const test = useCallback(() => {
    // Immediate, because a test that arrives two seconds later is a test you are still
    // watching for; and it says "this is a test" in its own body rather than borrowing the
    // rest-timer wording.
    void notifySettingsTest().catch(() => undefined);
  }, []);

  const granted = notifications.granted;
  const minutes = Math.max(0, Math.min(REMINDER_LAST_MINUTE, reminder.minuteOfDay));
  const scheduling = reminder.enabled && enabled && granted;

  const sections = useMemo<SettingsSection[]>(() => {
    const list: SettingsSection[] = [
      {
        // The OS answer, as the separate fact it is. After a refusal iOS never asks again, so
        // the ask row only exists while asking can still work.
        key: 'system',
        title: t('notif.systemPermission'),
        footer: t(granted ? 'notif.systemAllowed' : 'notif.systemDenied'),
        rows: [
          {
            kind: 'info',
            key: 'status',
            title: t(granted ? 'notif.maySend' : 'notif.mayNotSend'),
            value: t(granted ? 'perms.granted' : 'perms.notGranted'),
          },
          ...(granted
            ? []
            : [
                {
                  kind: 'button' as const,
                  key: 'ask',
                  title: t(granting ? 'notif.waiting' : 'notif.askForPermission'),
                  disabled: granting,
                  onPress: () => void ask(),
                },
              ]),
        ],
      },
      {
        key: 'master',
        title: t('notif.inAppAlerts'),
        ...(granted ? {} : { footer: t('notif.masterOffBecause') }),
        rows: [
          {
            kind: 'switch',
            key: 'send',
            title: t('notif.sendNotifications'),
            subtitle: t(enabled && granted ? 'notif.onBody' : 'notif.offBody'),
            // What actually happens, not the stored wish: with the system permission missing,
            // a switch drawn on sat under a footer saying notifications are off.
            value: enabled && granted,
            disabled: !granted,
            onChange: toggleMaster,
          },
        ],
      },
      {
        key: 'rest',
        title: t('notif.restTimer'),
        footer: `${t('notif.restBody')} ${t('notif.restNote')}`,
        rows:
          enabled && granted
            ? [{ kind: 'button', key: 'test', title: t('notif.sendTest'), onPress: test }]
            : [],
      },
      {
        key: 'reminder',
        title: t('notif.weeklyReminder'),
        ...(deferred
          ? { footer: t('misc.midSessionNote') }
          : scheduling
            ? {
                footer:
                  reminder.days.length === 0
                    ? t('notif.noDaysWarning')
                    : t('notif.daysSummary', {
                        days: describeDays(reminder.days, locale),
                        count: reminder.days.length,
                        word: t('notif.timeWord', { count: reminder.days.length }),
                      }),
              }
            : {}),
        rows: [
          {
            kind: 'switch',
            key: 'remind',
            title: t('notif.remindMe'),
            subtitle: reminderHint(reminder, enabled, granted, locale),
            value: scheduling,
            disabled: !enabled || !granted,
            onChange: (next) => commit({ enabled: next }),
          },
          ...(scheduling
            ? [
                {
                  kind: 'stepper' as const,
                  key: 'time',
                  title: t('notif.time'),
                  subtitle: t('notif.timeNote'),
                  value: minutes,
                  min: 0,
                  max: REMINDER_LAST_MINUTE,
                  step: REMINDER_STEP_MINUTES,
                  format: formatClock,
                  onChange: (next: number) => commit({ minuteOfDay: next }),
                },
                ...ISO_DAYS.map((iso) => {
                  const on = reminder.days.includes(iso);
                  return {
                    kind: 'check' as const,
                    key: `day-${iso}`,
                    title: dayName(iso, locale),
                    checked: on,
                    onPress: () =>
                      commit({
                        days: on
                          ? reminder.days.filter((d) => d !== iso)
                          : [...reminder.days, iso].sort((a, b) => a - b),
                      }),
                  };
                }),
              ]
            : []),
        ],
      },
    ];
    return list.filter((section) => section.rows.length > 0 || section.footer);
  }, [ask, commit, deferred, enabled, granted, granting, locale, minutes, reminder, scheduling, t, test, toggleMaster]);

  return (
    <>
      <ScreenHeader title={t('notif.title')} largeTitle />
      <SettingsList sections={sections} />
    </>
  );
}

/**
 * The hint describes the outcome the user is actually in, which is why it reads three
 * settings at once. "Remind me to train" being on while the OS says no is the state this
 * sentence exists to catch.
 */
function reminderHint(
  reminder: ReminderSettings,
  enabled: boolean,
  granted: boolean,
  locale: string,
): string {
  if (!enabled) return tr('notif.offOnScreen');
  if (!granted) return tr('notif.blocked');
  if (!reminder.enabled) return tr('notif.oneNudge');
  if (reminder.days.length === 0) return tr('notif.noDaysSelected');
  return tr('notif.scheduleAt', {
    days: describeDays(reminder.days, locale),
    time: formatClock(reminder.minuteOfDay),
  });
}

/** "Mon, Wed, Fri" / "Mon-Fri" / "Every day", from an ISO day set. */
function describeDays(days: readonly number[], locale: string): string {
  const names = ISO_DAYS.filter((iso) => days.includes(iso)).map((iso) => dayLabel(iso, locale));
  if (names.length === 7) return tr('notif.everyDay');
  if (names.length === 1) return names[0] ?? tr('notif.noDays');

  // A run of consecutive ISO days is a range, and "Mon-Fri" is what a person would say.
  const sorted = [...days].sort((a, b) => a - b);
  const contiguous = sorted.every(
    (d, i) => i === 0 || d === (sorted[i - 1] ?? Number.NaN) + 1,
  );
  if (contiguous && sorted.length > 2) {
    const first = sorted[0] === undefined ? undefined : dayLabel(sorted[0], locale);
    const lastIso = sorted[sorted.length - 1];
    const last = lastIso === undefined ? undefined : dayLabel(lastIso, locale);
    if (first && last) return `${first}-${last}`;
  }
  return names.join(', ');
}
