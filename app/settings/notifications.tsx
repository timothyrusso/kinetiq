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
 * Cancelling means `cancelAllScheduledNotificationsAsync`, which cannot be selective, * expo-notifications has no cancel-by-purpose. Mid-workout, the notification that is about to
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
import { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useScreenContentBottom } from '@/ui/insets';

import { DetailScreen } from '@/ui/Screen';
import { Card, Divider, Row, SectionHeader, Stack } from '@/ui/layout';
import { Chip, Toggle } from '@/ui/controls';
import { Button, IconButton } from '@/ui/Button';
import { Txt } from '@/ui/Text';
import { useSettings, useSettingsUpdate } from '@/settings';
import type { ReminderSettings } from '@/settings';
import { usePermissions } from '@/queries/usePermissions';
import { useAppTheme } from '@/theme/theme';
import { spacing, screenGutter } from '@/theme/tokens';
import {
  clearScheduledNotifications,
  notifySettingsTest,
  syncTrainingReminder,
} from '@/services/notifications';
import { getSessionSnapshot } from '@/workout/session';
import { haptics } from '@/services/haptics';
import { useT } from '@/i18n/useT';
import { tr } from '@/i18n/tr';
import { formatClock } from '@/utils/format';

/** A quarter-hour grid: nobody wants 18:07, and finer steps make the stepper pointless. */
const REMINDER_STEP_MINUTES = 15;
/** 23:45 is the latest slot; midnight itself belongs to the next day. */
const REMINDER_LAST_MINUTE = 24 * 60 - REMINDER_STEP_MINUTES;

/** ISO weekdays, Monday first. Their names come from `Intl`; see `dayLabel`. */
const ISO_DAYS: readonly number[] = [1, 2, 3, 4, 5, 6, 7];

/**
 * Short weekday names from `Intl`, not from a table of English abbreviations.
 *
 * A hand-written `['Mon', 'Tue', ...]` would need a translated copy per locale, and would then
 * be a second opinion about weekday names that the platform already holds. The reference date
 * is an arbitrary Monday (2024-01-01 was one), so ISO day 1 maps to it and the rest follow.
 */
function dayLabel(iso: number, locale: string): string {
  const reference = new Date(Date.UTC(2024, 0, iso, 12));
  return new Intl.DateTimeFormat(locale, { weekday: 'short', timeZone: 'UTC' }).format(reference);
}

export default function SettingsNotificationsScreen() {
  const { t, locale } = useT();
  const bottomSpace = useScreenContentBottom();
  const theme = useAppTheme();
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

  return (
    <DetailScreen title={t('notif.title')} largeTitle>
      {(topInset) => (
        <ScrollView
          contentContainerStyle={[
            styles.content,
            { paddingTop: topInset + spacing.md, paddingBottom: bottomSpace },
          ]}
          // `automatic`, so iOS owns the inset under the large title and can collapse it as
          // this view scrolls. Without it the title stays large forever and the screen looks
          // like a native header that does not work.
          contentInsetAdjustmentBehavior="automatic"
          keyboardShouldPersistTaps="handled"
        >
          <Stack gap="xxl" style={styles.body}>
            {/* --------------------------------------------------- OS permission -- */}
            <OsPermission granted={granted} busy={granting} onAsk={() => void ask()} />

            {/* --------------------------------------------------------- master -- */}
            <View>
              <SectionHeader title={t('notif.inAppAlerts')} />
              <Card padding="xxs">
                <ToggleRow
                  label={t('notif.sendNotifications')}
                  hint={t(enabled ? 'notif.onBody' : 'notif.offBody')}
                  value={enabled}
                  disabled={!granted}
                  onChange={toggleMaster}
                />
                {!granted ? (
                  <>
                    <Divider inset={spacing.lg} />
                    <View style={styles.note}>
                      <Txt variant="caption" tone="muted">
                        {t('notif.masterOffBecause')}
                      </Txt>
                    </View>
                  </>
                ) : null}
              </Card>
            </View>

            {/* -------------------------------------------------- rest timer -- */}
            <View>
              <SectionHeader title={t('notif.restTimer')} eyebrow={t('notif.whileRunning')} />
              <Card>
                <Stack gap="md">
                  <Txt variant="caption" tone="muted">
                    {t('notif.restBody')}
                  </Txt>
                  <Txt variant="micro" tone="faint">
                    {t('notif.restNote')}
                  </Txt>
                  {enabled && granted ? (
                    <>
                      <Divider inset={0} />
                      <Row align="center" gap="md">
                        <Stack gap="xxs" style={{ flex: 1 }}>
                          <Txt variant="strong">{t('notif.sendTest')}</Txt>
                          <Txt variant="caption" tone="muted">
                            {t('notif.testArrives')}
                          </Txt>
                        </Stack>
                        <IconButton
                          name="bell"
                          variant="surface"
                          accessibilityLabel={t('notif.sendTestA11y')}
                          accessibilityHint={t('notif.sendTestHint')}
                          onPress={test}
                        />
                      </Row>
                    </>
                  ) : null}
                </Stack>
              </Card>
            </View>

            {/* ------------------------------------------------------- reminder -- */}
            <View>
              <SectionHeader
                title={t('notif.weeklyReminder')}
                eyebrow={
                  enabled && granted && reminder.enabled && reminder.days.length > 0
                    ? t('notif.scheduled')
                    : undefined
                }
              />
              <Card padding="lg">
                <Stack gap="lg">
                  <ToggleRow
                    label={t('notif.remindMe')}
                    hint={reminderHint(reminder, enabled, granted, locale)}
                    value={reminder.enabled && enabled && granted}
                    disabled={!enabled || !granted}
                    onChange={(next) => commit({ enabled: next })}
                  />

                  {reminder.enabled && enabled && granted ? (
                    <>
                      <Divider inset={0} />

                      <Row align="center" gap="lg">
                        <Stack gap="xxs" style={{ flex: 1 }}>
                          <Txt variant="strong">{t('notif.time')}</Txt>
                          <Txt variant="caption" tone="muted">
                            {t('notif.timeNote')}
                          </Txt>
                        </Stack>
                        <Row align="center" gap="sm">
                          <IconButton
                            name="minus"
                            variant="surface"
                            accessibilityLabel={`Earlier, ${formatClock(
                              minutes - REMINDER_STEP_MINUTES,
                            )}`}
                            disabled={minutes <= 0}
                            onPress={() =>
                              commit({ minuteOfDay: Math.max(0, minutes - REMINDER_STEP_MINUTES) })
                            }
                          />
                          {/* The readout is a live region: the arrows repeat and the number
                              changing in silence is otherwise unreadable without looking. */}
                          <View style={styles.clock} accessibilityLiveRegion="polite">
                            <Txt variant="numeralSm">{formatClock(minutes)}</Txt>
                          </View>
                          <IconButton
                            name="plus"
                            variant="surface"
                            accessibilityLabel={`Later, ${formatClock(
                              minutes + REMINDER_STEP_MINUTES,
                            )}`}
                            disabled={minutes >= REMINDER_LAST_MINUTE}
                            onPress={() =>
                              commit({
                                minuteOfDay: Math.min(
                                  REMINDER_LAST_MINUTE,
                                  minutes + REMINDER_STEP_MINUTES,
                                ),
                              })
                            }
                          />
                        </Row>
                      </Row>

                      <Divider inset={0} />

                      <Stack gap="sm">
                        <Txt variant="strong">{t('notif.days')}</Txt>
                        <Row gap="sm" style={styles.chips}>
                          {ISO_DAYS.map((iso) => {
                            const on = reminder.days.includes(iso);
                            return (
                              <Chip
                                key={iso}
                                label={dayLabel(iso, locale)}
                                selected={on}
                                size="sm"
                                onPress={() =>
                                  commit({
                                    days: on
                                      ? reminder.days.filter((d) => d !== iso)
                                      : [...reminder.days, iso].sort((a, b) => a - b),
                                  })
                                }
                              />
                            );
                          })}
                        </Row>
                        {reminder.days.length === 0 ? (
                          <Txt variant="micro" tone="warning">
                            {t('notif.noDaysWarning')}
                          </Txt>
                        ) : (
                          <Txt variant="micro" tone="faint">
                            {t('notif.daysSummary', {
                              days: describeDays(reminder.days, locale),
                              count: reminder.days.length,
                              word: t('notif.timeWord', { count: reminder.days.length }),
                            })}
                          </Txt>
                        )}
                      </Stack>
                    </>
                  ) : null}

                  {deferred ? (
                    <View style={[styles.note, { backgroundColor: theme.colors.accentSoft }]}>
                      <Txt variant="caption" tone="default">
                        {t('misc.midSessionNote')}
                      </Txt>
                    </View>
                  ) : null}
                </Stack>
              </Card>
            </View>
          </Stack>
        </ScrollView>
      )}
    </DetailScreen>
  );
}

/* ------------------------------------------------------------------ pieces -- */

/**
 * The OS answer, stated as the separate fact it is.
 *
 * `status === 'denied'` is the interesting case: iOS stops asking after the first refusal, so
 * the button here cannot fix it: only send the user to Settings. Showing a "Allow" button in
 * that state is the classic dead-end, so the copy says where to go instead of offering a tap
 * that does nothing.
 */
function OsPermission({
  granted,
  busy,
  onAsk,
}: {
  granted: boolean;
  busy: boolean;
  onAsk: () => void;
}) {
  const { t } = useT();
  const theme = useAppTheme();

  // Two different reasons for `false`, and the second one has a different remedy. Before the
  // first answer iOS will ask again on request; after a refusal it never asks a second time,
  // so the only fix lives in the Settings app. Offering an "Allow" button there is a tap that
  // does nothing, which is why the button is conditional and the copy is not.
  const detail = t(granted ? 'notif.systemAllowed' : 'notif.systemDenied');

  return (
    <View>
      <SectionHeader
        title={t('notif.systemPermission')}
        eyebrow={t(granted ? 'perms.granted' : 'perms.notGranted')}
      />
      <Card>
        <Stack gap="md">
          <Row gap="md" align="center">
            <View
              style={[
                styles.dot,
                { backgroundColor: granted ? theme.colors.success : theme.colors.warning },
              ]}
            />
            <Txt variant="strong" style={{ flex: 1 }}>
              {t(granted ? 'notif.maySend' : 'notif.mayNotSend')}
            </Txt>
          </Row>
          <Txt variant="caption" tone="muted">
            {detail}
          </Txt>
          {!granted ? (
            <Button
              label={t('notif.askForPermission')}
              variant="secondary"
              icon="bell"
              loading={busy}
              onPress={onAsk}
              accessibilityHint={
                t(busy ? 'notif.waiting' : 'notif.askHint')
              }
            />
          ) : null}
        </Stack>
      </Card>
    </View>
  );
}

/**
 * Label plus a switch. Same shape as the Training screen's row, and duplicated rather than
 * shared for the reason in `hooks.md`'s worklet note carried over to components: two screens
 * that happen to look alike today diverge the moment one of them needs a badge, and the
 * extraction would have to be undone rather than extended.
 */
function ToggleRow({
  label,
  hint,
  value,
  onChange,
  disabled = false,
}: {
  label: string;
  hint: string;
  value: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <View style={styles.toggleRow}>
      <Stack gap="xxs" style={styles.toggleText}>
        <Txt variant="strong">{label}</Txt>
        <Txt variant="caption" tone="muted">
          {hint}
        </Txt>
      </Stack>
      <Toggle
        value={value}
        onChange={onChange}
        disabled={disabled}
        accessibilityLabel={label}
      />
    </View>
  );
}

/* ----------------------------------------------------------------- helpers -- */

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

const styles = StyleSheet.create({
  content: { flexGrow: 1 },
  body: { paddingHorizontal: screenGutter },
  chips: { flexWrap: 'wrap' },
  dot: { width: 10, height: 10, borderRadius: 5 },
  clock: { minWidth: 62, alignItems: 'center' },
  note: {
    padding: spacing.md,
    borderRadius: 12,
    backgroundColor: 'transparent',
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
  },
  toggleText: { flex: 1 },
});
