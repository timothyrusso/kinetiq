/**
 * Notifications — the rest-timer alert, the weekly reminder, and the OS permission that
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
 * rather than deferring — a reminder you just configured that only appears after a restart is
 * indistinguishable from one that was never saved.
 *
 * ## The one case where it deliberately does *not* re-sync
 *
 * Cancelling means `cancelAllScheduledNotificationsAsync`, which cannot be selective —
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
import { spacing } from '@/theme/tokens';
import {
  clearScheduledNotifications,
  notifySettingsTest,
  syncTrainingReminder,
} from '@/services/notifications';
import { getSessionSnapshot } from '@/workout/session';
import { haptics } from '@/services/haptics';
import {
  countNoun,
  formatClock,
} from '@/utils/format';

/** A quarter-hour grid: nobody wants 18:07, and finer steps make the stepper pointless. */
const REMINDER_STEP_MINUTES = 15;
/** 23:45 is the latest slot; midnight itself belongs to the next day. */
const REMINDER_LAST_MINUTE = 24 * 60 - REMINDER_STEP_MINUTES;

/** ISO weekday (1 = Monday … 7 = Sunday) to a two-letter label. */
const DAYS: readonly { iso: number; label: string }[] = [
  { iso: 1, label: 'Mon' },
  { iso: 2, label: 'Tue' },
  { iso: 3, label: 'Wed' },
  { iso: 4, label: 'Thu' },
  { iso: 5, label: 'Fri' },
  { iso: 6, label: 'Sat' },
  { iso: 7, label: 'Sun' },
];

export default function SettingsNotificationsScreen() {
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
   * decides whether the schedule is rebuilt — the mid-session exception cannot be forgotten by
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
    <DetailScreen title="Notifications">
      {(topInset) => (
        <ScrollView
          contentContainerStyle={[
            styles.content,
            { paddingTop: topInset + spacing.md, paddingBottom: bottomSpace },
          ]}
          keyboardShouldPersistTaps="handled"
        >
          <Stack gap="xxl" style={styles.body}>
            {/* --------------------------------------------------- OS permission -- */}
            <OsPermission granted={granted} busy={granting} onAsk={() => void ask()} />

            {/* --------------------------------------------------------- master -- */}
            <View>
              <SectionHeader title="In-app alerts" />
              <Card padding="xxs">
                <ToggleRow
                  label="Send notifications"
                  hint={
                    enabled
                      ? 'Rest timer and weekly reminder.'
                      : 'Nothing will be delivered, and nothing will be scheduled.'
                  }
                  value={enabled}
                  disabled={!granted}
                  onChange={toggleMaster}
                />
                {!granted ? (
                  <>
                    <Divider inset={spacing.lg} />
                    <View style={styles.note}>
                      <Txt variant="caption" tone="muted">
                        This is off because iOS has not allowed notifications yet. Your rest
                        timer still counts down on screen — you just have to look at it.
                      </Txt>
                    </View>
                  </>
                ) : null}
              </Card>
            </View>

            {/* -------------------------------------------------- rest timer -- */}
            <View>
              <SectionHeader title="Rest timer" eyebrow="While a session is running" />
              <Card>
                <Stack gap="md">
                  <Txt variant="caption" tone="muted">
                    Armed the moment a rest starts and fired when it ends, so the phone can go
                    face-down between sets. Skip the rest and the alert is retracted with it.
                  </Txt>
                  <Txt variant="micro" tone="faint">
                    Follows the timer on the Training screen. There is no separate length here,
                    and there is deliberately no second switch — two controls for one countdown
                    is how you end up with a rest timer that says 90 and buzzes at 60.
                  </Txt>
                  {enabled && granted ? (
                    <>
                      <Divider inset={0} />
                      <Row align="center" gap="md">
                        <Stack gap="xxs" style={{ flex: 1 }}>
                          <Txt variant="strong">Send a test alert</Txt>
                          <Txt variant="caption" tone="muted">
                            Arrives in about two seconds.
                          </Txt>
                        </Stack>
                        <IconButton
                          name="bell"
                          variant="surface"
                          accessibilityLabel="Send a test notification"
                          accessibilityHint="Posts a notification now so you can check delivery"
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
                title="Weekly reminder"
                eyebrow={
                  enabled && granted && reminder.enabled && reminder.days.length > 0
                    ? 'Scheduled'
                    : undefined
                }
              />
              <Card padding="lg">
                <Stack gap="lg">
                  <ToggleRow
                    label="Remind me to train"
                    hint={reminderHint(reminder, enabled, granted)}
                    value={reminder.enabled && enabled && granted}
                    disabled={!enabled || !granted}
                    onChange={(next) => commit({ enabled: next })}
                  />

                  {reminder.enabled && enabled && granted ? (
                    <>
                      <Divider inset={0} />

                      <Row align="center" gap="lg">
                        <Stack gap="xxs" style={{ flex: 1 }}>
                          <Txt variant="strong">Time</Txt>
                          <Txt variant="caption" tone="muted">
                            Local time, and it follows you across time zones.
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
                        <Txt variant="strong">Days</Txt>
                        <Row gap="sm" style={styles.chips}>
                          {DAYS.map((day) => {
                            const on = reminder.days.includes(day.iso);
                            return (
                              <Chip
                                key={day.iso}
                                label={day.label}
                                selected={on}
                                size="sm"
                                onPress={() =>
                                  commit({
                                    days: on
                                      ? reminder.days.filter((d) => d !== day.iso)
                                      : [...reminder.days, day.iso].sort((a, b) => a - b),
                                  })
                                }
                              />
                            );
                          })}
                        </Row>
                        {reminder.days.length === 0 ? (
                          <Txt variant="micro" tone="warning">
                            No days selected, so nothing is scheduled. Pick at least one.
                          </Txt>
                        ) : (
                          <Txt variant="micro" tone="faint">
                            {describeDays(reminder.days)} · {countNoun(reminder.days.length, 'time')} a
                            week.
                          </Txt>
                        )}
                      </Stack>
                    </>
                  ) : null}

                  {deferred ? (
                    <View style={[styles.note, { backgroundColor: theme.colors.accentSoft }]}>
                      <Txt variant="caption" tone="default">
                        You are mid-session, so the schedule was saved but not re-armed — your
                        rest timer keeps the alert it already has. It updates when the session
                        ends.
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
 * the button here cannot fix it — only send the user to Settings. Showing a "Allow" button in
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
  const theme = useAppTheme();

  // Two different reasons for `false`, and the second one has a different remedy. Before the
  // first answer iOS will ask again on request; after a refusal it never asks a second time,
  // so the only fix lives in the Settings app. Offering an "Allow" button there is a tap that
  // does nothing, which is why the button is conditional and the copy is not.
  const detail = granted
    ? 'Allowed. Everything below can be delivered.'
    : 'If this is wrong, open iOS Settings, tap Kinetiq, then Allow Notifications. This screen re-reads the answer whenever you come back to the app.';

  return (
    <View>
      <SectionHeader title="System permission" eyebrow={granted ? 'Granted' : 'Not granted'} />
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
              {granted ? 'Kinetiq may send notifications' : 'Kinetiq may not send notifications'}
            </Txt>
          </Row>
          <Txt variant="caption" tone="muted">
            {detail}
          </Txt>
          {!granted ? (
            <Button
              label="Ask iOS for permission"
              variant="secondary"
              icon="bell"
              loading={busy}
              onPress={onAsk}
              accessibilityHint={
                busy
                  ? 'Waiting for your answer'
                  : 'iOS shows its own prompt, or tells you to use the Settings app'
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
function reminderHint(reminder: ReminderSettings, enabled: boolean, granted: boolean): string {
  if (!enabled) return 'Notifications are off on this screen.';
  if (!granted) return 'iOS is blocking notifications.';
  if (!reminder.enabled) return 'One nudge on the days you choose.';
  if (reminder.days.length === 0) return 'Turned on, but no days selected.';
  return `${describeDays(reminder.days)} at ${formatClock(reminder.minuteOfDay)}.`;
}

/** "Mon, Wed, Fri" / "Mon–Fri" / "Every day", from an ISO day set. */
function describeDays(days: readonly number[]): string {
  const names = DAYS.filter((d) => days.includes(d.iso)).map((d) => d.label);
  if (names.length === 7) return 'Every day';
  if (names.length === 1) return names[0] ?? 'No days';

  // A run of consecutive ISO days is a range, and "Mon–Fri" is what a person would say.
  const sorted = [...days].sort((a, b) => a - b);
  const contiguous = sorted.every(
    (d, i) => i === 0 || d === (sorted[i - 1] ?? Number.NaN) + 1,
  );
  if (contiguous && sorted.length > 2) {
    const first = DAYS.find((d) => d.iso === sorted[0])?.label;
    const last = DAYS.find((d) => d.iso === sorted[sorted.length - 1])?.label;
    if (first && last) return `${first}–${last}`;
  }
  return names.join(', ');
}

const styles = StyleSheet.create({
  content: { flexGrow: 1 },
  body: { paddingHorizontal: spacing.xl },
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
