/**
 * Permissions: what iOS and Android decide on the app's behalf, in one place,
 * stated as facts about the device rather than as checkboxes the app owns.
 *
 * ## Why this screen exists separately from Settings
 *
 * The Settings hub has a "Notifications" screen, and this one also talks about notifications.
 * That is deliberate and it is not duplication: the notification *screen* configures a schedule
 * (which days, what time, which alerts), and this screen reports and requests what the operating
 * system will allow. They are different questions, and merging them produces the classic bug
 * where a schedule looks configured while the OS blocks every delivery. So this screen owns the
 * permission, links to that one for the schedule, and never edits `reminder`.
 *
 * ## The reading is live, and it has to be
 *
 * `usePermissions` re-reads the answer whenever the app returns to the foreground, which is
 * the only way this screen can be truthful: the user can revoke the permission in the system
 * app while Kinetiq is suspended, and a screen that cached the answer at mount would keep
 * saying "Granted" to a phone that has stopped granting.
 *
 * ## Every denial here is a supported configuration
 *
 * Nothing on this screen says a feature is broken. Notifications off means the rest timer counts
 * down on screen instead of buzzing. That is stated as what changes, because a permission screen that
 * reads as an apology is how you end up with users who never try the feature.

 */
import { useCallback, useMemo } from 'react';
import { useRouter } from 'expo-router';

import { ScreenHeader } from '@/ui/Screen';
import { SettingsList, type SettingsSection } from '@/ui/controls/SettingsList';
import { usePermissions } from '@/queries/usePermissions';
import { useSettings, useSettingsUpdate } from '@/settings';
import { routes } from '@/navigation/nav';
import { haptics } from '@/services/haptics';
import { useT } from '@/i18n/useT';
import type { TKey } from '@/i18n';

export default function PermissionsScreen() {
  const { t } = useT();
  const router = useRouter();

  const { notifications, requesting, requestNotifications } = usePermissions();

  const hapticsEnabled = useSettings((s) => s.hapticsEnabled);
  const notificationsEnabled = useSettings((s) => s.notificationsEnabled);
  const update = useSettingsUpdate();

  const askNotifications = useCallback(async () => {
    const next = await requestNotifications();
    if (next.granted) haptics.success();
    else haptics.warning();
  }, [requestNotifications]);

  const sections = useMemo<SettingsSection[]>(() => {
    const list: SettingsSection[] = [
      {
        key: 'notifications',
        title: t('perms.notifications'),
        footer: notifications.granted ? t('perms.notifGrantedBody') : t('perms.notifDeniedBody'),
        rows: [
          {
            kind: 'info',
            key: 'status',
            title: notifications.granted ? t('perms.notifGranted') : t('perms.notifDenied'),
            value: t(notifications.granted ? 'perms.granted' : 'perms.notGranted'),
          },
          ...(notifications.granted
            ? []
            : [
                {
                  kind: 'button' as const,
                  key: 'ask',
                  title: t('perms.askAgain'),
                  disabled: requesting,
                  onPress: () => void askNotifications(),
                },
              ]),
          {
            kind: 'switch',
            key: 'send',
            title: t('perms.sendThemAtAll'),
            subtitle: t('perms.ownSwitch'),
            value: notificationsEnabled,
            onChange: (next) => update({ notificationsEnabled: next }),
          },
          {
            kind: 'nav',
            key: 'reminder',
            title: t('perms.reminderDays'),
            onPress: () => router.push(routes.settingsNotifications()),
          },
        ],
      },
      {
        key: 'motion',
        title: t('perms.motion'),
        footer: t('perms.noSystemPermission'),
        rows: [
          {
            kind: 'switch',
            key: 'haptics',
            title: t('perms.haptics'),
            subtitle: t('misc.hapticsBody'),
            value: hapticsEnabled,
            onChange: (next) => update({ hapticsEnabled: next }),
          },
        ],
      },
      {
        key: 'never',
        title: t('perms.neverRequested'),
        rows: NEVER_ASKED.map((item) => ({
          kind: 'info' as const,
          key: item.title,
          title: t(item.title),
          subtitle: t(item.detail),
        })),
      },
    ];
    return list;
  }, [askNotifications, hapticsEnabled, notifications.granted, notificationsEnabled, requesting, router, t, update]);

  return (
    <>
      <ScreenHeader title={t('perms.title')} largeTitle />
      <SettingsList sections={sections} />
    </>
  );
}

/* ----------------------------------------------------------------- helpers -- */

/**
 * The permissions the app deliberately does not request.
 *
 * This card is here because the absence of a permission prompt is information a user cannot
 * otherwise get: they may assume a fitness app reads HealthKit or tracks them in the background
 * because nothing said otherwise. Each line is a promise that is currently true: checked
 * against the `expo.plugins` list in app.json, not against intent.
 */
const NEVER_ASKED: readonly { title: TKey; detail: TKey }[] = [
  { title: 'perms.neverBackgroundTitle', detail: 'perms.neverBackgroundDetail' },
  { title: 'perms.neverHealthTitle', detail: 'perms.neverHealthDetail' },
  { title: 'perms.neverMotionTitle', detail: 'perms.neverMotionDetail' },
];
