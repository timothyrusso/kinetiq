import { useCallback, useMemo, useState } from 'react';
import type { SettingsSection } from '@/features/core/design-system';
import { haptics } from '@/features/core/haptics';
import { isSessionInProgress } from '@/features/core/state';
import { useT } from '@/features/core/translations';
import { formatClock } from '@/features/core/utils';
import { useNotificationPermission } from '@/features/notifications/facades/useNotificationPermission';
import { useReminderSchedule } from '@/features/notifications/facades/useReminderSchedule';
import { dayName, describeDays, ISO_DAYS, reminderHint } from '@/features/notifications/mappers/describeReminder';
import { type ReminderSettings, useSettings, useSettingsUpdate } from '@/features/settings';

/** A quarter-hour grid: nobody wants 18:07, and finer steps make the stepper pointless. */
const REMINDER_STEP_MINUTES = 15;
/** 23:45 is the latest slot; midnight itself belongs to the next day. */
const REMINDER_LAST_MINUTE = 24 * 60 - REMINDER_STEP_MINUTES;

/**
 * The notifications screen: the rest-timer alert, the weekly reminder, and the system permission
 * that decides whether either can exist.
 *
 * Three switches, three meanings. `notificationsEnabled` is the app's own master switch,
 * `reminder.enabled` is a schedule, and the permission is the operating system's answer, set in
 * another app and revocable there. Collapsing them into one toggle is how everything looks on
 * while nothing arrives, so the permission gets its own section, read from the device rather
 * than from the store.
 *
 * Every change rebuilds the reminder schedule at once (a reminder that only appears after a
 * restart is indistinguishable from one never saved), except mid-workout: the rebuild cancels
 * everything the app scheduled, and the notification about to fire is a rest alert the user is
 * relying on. Then the schedule is left alone and the screen says so; the session's end and the
 * next return to the foreground reconcile it.
 *
 * Denial is a supported state everywhere: the rest timer counts on screen with no permission at
 * all, so the permission changes what notifies, not what works.
 */
export function useNotificationsSettingsPageLogic() {
  const { t, locale } = useT();
  const update = useSettingsUpdate();
  const { granted, requesting, request } = useNotificationPermission();
  const { sync, clear, sendTest } = useReminderSchedule();

  const enabled = useSettings(settings => settings.notificationsEnabled);
  const reminder = useSettings(settings => settings.reminder);

  // NOTE: "we did not re-sync" is a fact about the moment of the tap, not about the settings, so
  // it is held here: a user who turns the reminder on mid-session needs to know it is waiting.
  const [deferred, setDeferred] = useState(false);

  // NOTE: every reminder control commits through here, so none can forget the mid-session exception.
  const commit = useCallback(
    (patch: Partial<ReminderSettings>) => {
      const nextReminder = { ...reminder, ...patch };
      update({ reminder: nextReminder });
      if (isSessionInProgress()) {
        setDeferred(true);
        return;
      }
      setDeferred(false);
      sync({ reminder: nextReminder, enabled });
    },
    [enabled, reminder, sync, update],
  );

  const toggleMaster = useCallback(
    (next: boolean) => {
      update({ notificationsEnabled: next });
      setDeferred(false);
      // NOTE: switching off must actually stop the alerts, not only say so: the scheduled
      // reminder is still in the system otherwise.
      if (next) sync({ reminder, enabled: true });
      else clear();
    },
    [clear, reminder, sync, update],
  );

  const ask = useCallback(() => {
    request(undefined, {
      onSuccess: answer => {
        if (!answer.granted) {
          haptics.warning();
          return;
        }
        haptics.success();
        sync({ reminder, enabled });
      },
      onError: () => haptics.warning(),
    });
  }, [enabled, reminder, request, sync]);

  const minutes = Math.max(0, Math.min(REMINDER_LAST_MINUTE, reminder.minuteOfDay));
  const scheduling = reminder.enabled && enabled && granted;

  const sections = useMemo<SettingsSection[]>(() => {
    const list: SettingsSection[] = [
      {
        // NOTE: after a refusal iOS never asks again, so the ask row exists only while asking can work.
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
                  title: t(requesting ? 'notif.waiting' : 'notif.askForPermission'),
                  disabled: requesting,
                  onPress: ask,
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
            // NOTE: what actually happens, not the stored wish: without the system permission a
            // switch drawn on sat under a footer saying notifications are off.
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
            ? [{ kind: 'button', key: 'test', title: t('notif.sendTest'), onPress: () => sendTest() }]
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
            onChange: next => commit({ enabled: next }),
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
                ...ISO_DAYS.map(iso => {
                  const on = reminder.days.includes(iso);
                  return {
                    kind: 'check' as const,
                    key: `day-${iso}`,
                    title: dayName(iso, locale),
                    checked: on,
                    onPress: () =>
                      commit({
                        days: on
                          ? reminder.days.filter(day => day !== iso)
                          : [...reminder.days, iso].sort((a, b) => a - b),
                      }),
                  };
                }),
              ]
            : []),
        ],
      },
    ];
    return list.filter(section => section.rows.length > 0 || section.footer);
  }, [
    ask,
    commit,
    deferred,
    enabled,
    granted,
    locale,
    minutes,
    reminder,
    requesting,
    scheduling,
    sendTest,
    t,
    toggleMaster,
  ]);

  return { derived: { title: t('notif.title'), sections } };
}
