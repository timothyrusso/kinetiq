/**
 * Permissions: the two things iOS and Android decide on the app's behalf, in one place,
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
 * `usePermissions` re-reads both answers whenever the app returns to the foreground, which is
 * the only way this screen can be truthful: the user can revoke either permission in the system
 * app while Kinetiq is suspended, and a screen that cached the answer at mount would keep
 * saying "Granted" to a phone that has stopped granting.
 *
 * ## Every denial here is a supported configuration
 *
 * Nothing on this screen says a feature is broken. Location off means distance is estimated from
 * elapsed time and the workout still records; notifications off means the rest timer counts down
 * on screen instead of buzzing. Both are stated as what changes, because a permission screen that
 * reads as an apology is how you end up with users who never try the feature.
 *
 * ## The simulator caveat, said out loud
 *
 * On a simulator, location is whatever you set in the debug menu: it does not drift, does not
 * lose signal, and does not report the accuracy floor real hardware has. The last section says
 * so, because the alternative is a reviewer concluding the GPS filtering code is dead weight when
 * it is only unexercised.
 */
import { useCallback, useMemo } from 'react';
import { useRouter } from 'expo-router';

import { ScreenHeader } from '@/ui/Screen';
import { SettingsList, type SettingsSection } from '@/ui/controls/SettingsList';
import { usePermissions } from '@/queries/usePermissions';
import { useSettings, useSettingsUpdate } from '@/settings';
import { degradationMessage } from '@/services/location';
import type { LocationPermissionStatus } from '@/services/location';
import { routes } from '@/navigation/nav';
import { haptics } from '@/services/haptics';
import { useT } from '@/i18n/useT';
import type { TKey } from '@/i18n';

export default function PermissionsScreen() {
  const { t } = useT();
  const router = useRouter();

  const { location, notifications, requesting, requestLocation, requestNotifications } =
    usePermissions();

  const hapticsEnabled = useSettings((s) => s.hapticsEnabled);
  const notificationsEnabled = useSettings((s) => s.notificationsEnabled);
  const update = useSettingsUpdate();

  const askLocation = useCallback(async () => {
    const next = await requestLocation();
    if (next === 'granted') haptics.success();
    else haptics.warning();
  }, [requestLocation]);

  const askNotifications = useCallback(async () => {
    const next = await requestNotifications();
    if (next.granted) haptics.success();
    else haptics.warning();
  }, [requestNotifications]);

  const sections = useMemo<SettingsSection[]>(() => {
    const locationOk = location === 'granted';
    const list: SettingsSection[] = [
      {
        key: 'location',
        title: t('perms.location'),
        footer: [
          t(LOCATION_COPY[location]),
          // Reduced accuracy is the interesting state: permission was given, so a screen that
          // only checks "granted or not" reports it as fine while distances quietly drift.
          location === 'reduced' ? `${degradationMessage('reduced-accuracy')} ${t('settingsExtra.preciseLocation')}` : null,
          location === 'denied' ? t('perms.deniedNote') : null,
          t('perms.storedLocally'),
        ]
          .filter(Boolean)
          .join('\n\n'),
        rows: [
          {
            kind: 'info',
            key: 'status',
            title: locationOk
              ? t('perms.locGranted')
              : location === 'reduced'
                ? t('perms.locReduced')
                : t('perms.locDenied'),
            value: t(LOCATION_EYEBROW[location]),
          },
          ...(locationOk
            ? []
            : [
                {
                  kind: 'button' as const,
                  key: 'ask',
                  title: t('perms.askAgain'),
                  disabled: requesting === 'location',
                  onPress: () => void askLocation(),
                },
              ]),
        ],
      },
      // The no-permission path is a feature, not an error, so it is its own section.
      ...(locationOk
        ? []
        : [{ key: 'without', title: t('perms.withoutItTitle'), footer: t('perms.withoutItBody'), rows: [] }]),
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
                  disabled: requesting === 'notifications',
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
      // Development honesty: the simulator has no GPS of its own.
      { key: 'sim', title: t('perms.simGps'), footer: t('perms.simGpsNote'), rows: [] },
    ];
    return list;
  }, [askLocation, askNotifications, hapticsEnabled, location, notifications.granted, notificationsEnabled, requesting, router, t, update]);

  return (
    <>
      <ScreenHeader title={t('perms.title')} largeTitle />
      <SettingsList sections={sections} />
    </>
  );
}

/* ----------------------------------------------------------------- helpers -- */

/**
 * One line per state, including the two that are not failures.
 *
 * Written as a record keyed by the union rather than an if-chain so that adding a fifth
 * `LocationPermissionStatus` to the service is a compile error here instead of a missing string
 * at runtime.
 */
const LOCATION_COPY: Record<LocationPermissionStatus, TKey> = {
  granted: 'perms.copyGranted',
  undetermined: 'perms.copyUndetermined',
  reduced: 'perms.copyReduced',
  denied: 'perms.copyDenied',
};

const LOCATION_EYEBROW: Record<LocationPermissionStatus, TKey> = {
  granted: 'perms.eyebrowGranted',
  undetermined: 'perms.eyebrowUndetermined',
  reduced: 'perms.eyebrowReduced',
  denied: 'perms.eyebrowDenied',
};

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
