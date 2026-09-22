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
 * saying "Granted" to a phone that has stopped granting. The header's count-down to "you can
 * come back and we will notice" is not reassurance, it is the mechanism.
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
import { useCallback } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useScreenContentBottom } from '@/ui/insets';
import { useRouter } from 'expo-router';

import { ScreenHeader } from '@/ui/Screen';
import { Card, Divider, Row, SectionHeader, Stack } from '@/ui/layout';
import { Button } from '@/ui/controls/Button';
import { Toggle } from '@/ui/controls';
import { Txt } from '@/ui/Text';
import { Icon } from '@/ui/icons';
import { PermissionState } from '@/ui/states';
import { usePermissions } from '@/queries/usePermissions';
import { useSettings, useSettingsUpdate } from '@/settings';
import { degradationMessage } from '@/services/location';
import type { LocationPermissionStatus } from '@/services/location';
import { routes } from '@/navigation/nav';
import { useAppTheme } from '@/theme/theme';
import { spacing, screenGutter } from '@/theme/tokens';
import { haptics } from '@/services/haptics';
import { useT } from '@/i18n/useT';
import type { TKey } from '@/i18n';


export default function PermissionsScreen() {
  const { t } = useT();
  const router = useRouter();
  const bottomSpace = useScreenContentBottom();
  const theme = useAppTheme();

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

  const locationMessage = t(LOCATION_COPY[location]);

  return (
    <>
      <ScreenHeader title={t('perms.title')} largeTitle />
      <ScrollView
        // `automatic`, so iOS owns the inset under the large title and can collapse it as
        // this view scrolls. Without it the title stays large forever.
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={[
          styles.content,
          { paddingTop: spacing.md, paddingBottom: bottomSpace },
        ]}
      >
        <Stack gap="xxl" style={styles.body}>
          {/* -------------------------------------------------------- location */}
          <View>
            <SectionHeader title={t('perms.location')} eyebrow={t(LOCATION_EYEBROW[location])} />
            <Card>
              <Stack gap="md">
                <StatusLine
                  ok={location === 'granted'}
                  icon="route"
                  label={
                    location === 'granted'
                      ? t('perms.locGranted')
                      : location === 'reduced'
                        ? t('perms.locReduced')
                        : t('perms.locDenied')
                  }
                />
                <Txt variant="caption" tone="muted">
                  {locationMessage}
                </Txt>

                {location === 'granted' ? null : (
                  <Button
                    label={t('perms.askAgain')}
                    variant="secondary"
                    icon="mapPin"
                    loading={requesting === 'location'}
                    onPress={() => void askLocation()}
                    accessibilityHint={t('perms.askHint')}
                  />
                )}

                {/* Reduced accuracy is the interesting state: permission was *given*, so a
                    screen that only checks "granted or not" reports it as fine and the user's
                    distances quietly drift. It gets its own warning strip. */}
                {location === 'reduced' ? (
                  <>
                    <Divider inset={0} />
                    <WarningStrip
                      message={`${degradationMessage('reduced-accuracy')} Turn on Precise Location in iOS Settings if the numbers look wrong.`}
                    />
                  </>
                ) : null}

                {location === 'denied' ? (
                  <>
                    <Divider inset={0} />
                    <Txt variant="micro" tone="faint">
                      {t('perms.deniedNote')}
                    </Txt>
                  </>
                ) : null}

                <Divider inset={0} />
                <Txt variant="micro" tone="faint">
                  {t('perms.storedLocally')}
                </Txt>
              </Stack>
            </Card>

            {/* The no-permission path is a feature, not an error screen: so it gets its own
                card rather than a sentence inside the permission card. */}
            {location === 'granted' ? null : (
              <View style={styles.after}>
                <Card tone="sunken">
                  <Stack gap="sm">
                    <Txt variant="strong">{t('perms.withoutItTitle')}</Txt>
                    <Txt variant="caption" tone="muted">
                      {t('perms.withoutItBody')}
                    </Txt>
                  </Stack>
                </Card>
              </View>
            )}
          </View>

          {/* --------------------------------------------------- notifications */}
          <View>
            <SectionHeader
              title={t('perms.notifications')}
              eyebrow={t(notifications.granted ? 'perms.granted' : 'perms.notGranted')}
            />
            <Card>
              <Stack gap="md">
                <StatusLine
                  ok={notifications.granted}
                  icon="bell"
                  label={
                    notifications.granted
                      ? t('perms.notifGranted')
                      : t('perms.notifDenied')
                  }
                />
                <Txt variant="caption" tone="muted">
                  {notifications.granted
                    ? t('perms.notifGrantedBody')
                    : t('perms.notifDeniedBody')}
                </Txt>

                {notifications.granted ? null : (
                  <Button
                    label={t('perms.askAgain')}
                    variant="secondary"
                    icon="bell"
                    loading={requesting === 'notifications'}
                    onPress={() => void askNotifications()}
                    accessibilityHint={t('perms.askHint')}
                  />
                )}

                <Divider inset={0} />
                <Row align="center" gap="md">
                  <Stack gap="xxs" style={{ flex: 1 }}>
                    <Txt variant="strong">{t('perms.sendThemAtAll')}</Txt>
                    <Txt variant="caption" tone="muted">
                      {t('perms.ownSwitch')}
                    </Txt>
                  </Stack>
                  <Toggle
                    value={notificationsEnabled}
                    onChange={(next) => update({ notificationsEnabled: next })}
                    accessibilityLabel={t('perms.sendNotifications')}
                  />
                </Row>
              </Stack>
            </Card>
            <View style={styles.after}>
              <Button
                label={t('perms.reminderDays')}
                variant="quiet"
                trailingIcon="chevronRight"
                onPress={() => router.push(routes.settingsNotifications())}
                accessibilityHint={t('perms.reminderHint')}
              />
            </View>
          </View>

          {/* ---------------------------------------------------------- motion */}
          <View>
            <SectionHeader title={t('perms.motion')} eyebrow={t('perms.noSystemPermission')} />
            <Card padding="lg">
              <Row align="center" gap="lg">
                <Stack gap="xxs" style={{ flex: 1 }}>
                  <Txt variant="strong">{t('perms.haptics')}</Txt>
                  <Txt variant="caption" tone="muted">
                    {t('misc.hapticsBody')}
                  </Txt>
                </Stack>
                <Toggle
                  value={hapticsEnabled}
                  onChange={(next) => update({ hapticsEnabled: next })}
                  accessibilityLabel={t('perms.haptics')}
                />
              </Row>
            </Card>
          </View>

          {/* --------------------------------------------------- what we don't ask */}
          <View>
            <SectionHeader title={t('perms.neverRequested')} />
            <Card padding="md">
              <Stack>
                {NEVER_ASKED.map((item, index) => (
                  <View key={item.title}>
                    {index > 0 ? <Hairline /> : null}
                    <View style={styles.neverRow}>
                      <Stack gap="xxs" style={{ flex: 1 }}>
                        <Txt variant="body">{t(item.title)}</Txt>
                        <Txt variant="caption" tone="muted">
                          {t(item.detail)}
                        </Txt>
                      </Stack>
                    </View>
                  </View>
                ))}
              </Stack>
            </Card>
          </View>

          {/* ------------------------------------------------------- dev honesty */}
          <PermissionState
            feature={t('perms.simGps')}
            icon="warning"
            message={t('perms.simGpsNote')}
            actionLabel={t('perms.understood')}
            onAction={() => router.back()}
            style={styles.simNote}
          />
        </Stack>
      </ScrollView>
    </>
  );

  function StatusLine({
    ok,
    icon,
    label,
  }: {
    ok: boolean;
    icon: 'route' | 'bell';
    label: string;
  }) {
    return (
      <Row gap="md" align="center">
        <View
          style={[
            styles.dot,
            { backgroundColor: ok ? theme.colors.success : theme.colors.warning },
          ]}
        />
        <Icon name={icon} size={18} color={theme.colors.textMuted} />
        <Txt variant="strong" style={{ flex: 1 }}>
          {label}
        </Txt>
      </Row>
    );
  }
}

/* ------------------------------------------------------------------ pieces -- */

function WarningStrip({ message }: { message: string }) {
  const theme = useAppTheme();
  return (
    <View style={[styles.strip, { backgroundColor: theme.colors.warningSoft }]}>
      <Txt variant="caption">{message}</Txt>
    </View>
  );
}

function Hairline() {
  const theme = useAppTheme();
  return (
    <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: theme.colors.hairline }} />
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

const styles = StyleSheet.create({
  content: { flexGrow: 1 },
  body: { paddingHorizontal: screenGutter },
  after: { marginTop: spacing.md },
  dot: { width: 10, height: 10, borderRadius: 5 },
  strip: {
    padding: spacing.md,
    borderRadius: 12,
  },
  neverRow: { paddingVertical: spacing.sm },
  simNote: { marginTop: spacing.sm },
});
