/**
 * Profile tab: identity, the two numbers worth glancing at, and the way out to settings.
 *
 * ## Why this is not a settings list
 *
 * The obvious version of this screen is a column of `NavRow`s: Units, Appearance,
 * Notifications, Training, About. That is a menu, and it makes the tab a launcher for four
 * screens the user visits once a year. Everything configurable that has an *observable*
 * effect on what this tab shows lives here as a control: units, theme: because changing
 * units is something you do while looking at a number that is in the wrong ones.
 *
 * ## ScrollView, not FlashList
 *
 * Same reasoning as the Workout tab: the content is a fixed handful of bounded cards. A
 * virtualiser would allocate a recycle pool larger than the row count and buy nothing but
 * a second implementation of every divider.
 *
 * ## Streak and goal, not history
 *
 * Two numbers, both of which change daily and neither of which is available anywhere else
 * at a glance. Everything else that lives in history: volumes, PRs, the heatmap: belongs
 * to Progress, which is a full screen with range controls, and repeating a third of it here
 * would just be a second place to be out of date.
 */
import { useMemo } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTabContentBottom } from '@/ui/insets';

import { Icon } from '@/ui/icons';
import { BarAction, CollapsibleHeader, CollapsibleHero, useScreenHeaderScroll } from '@/ui/Screen';
import { Avatar, NavRow } from '@/ui/rows';
import { Badge, Card, MetricGrid, Row, SectionHeader } from '@/ui/layout';
import { SegmentedControl, type Segment } from '@/ui/controls';
import { useT } from '@/i18n/useT';
import type { Language } from '@/i18n';
import { IconButton } from '@/ui/Button';
import { ProgressRing } from '@/ui/charts/ProgressRing';
import { Txt } from '@/ui/Text';
import { Divider, Stack } from '@/ui/layout';
import { useTrainingSummary } from '@/queries/useProgress';
import { useSettings, useSettingsUpdate } from '@/settings';
import { routes } from '@/navigation/nav';
import { useAppTheme } from '@/theme/theme';
import { spacing, screenGutter } from '@/theme/tokens';
import {
  formatDistance,
  formatDurationCompact,
  pluralWord,
} from '@/utils/format';
import type { UnitSystem } from '@/utils/format';
import type { ThemeMode } from '@/settings';


const THEME_OPTIONS: readonly Segment<ThemeMode>[] = [
  { value: 'system', label: 'System' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
];

/**
 * `system` first, because it is the default and the one most people should leave alone. The
 * names are each written IN their own language: someone who has the app in a language they
 * cannot read still has to find their own.
 */
const LANGUAGE_OPTIONS: readonly Segment<Language>[] = [
  { value: 'system', label: 'System' },
  { value: 'en', label: 'English' },
  { value: 'it', label: 'Italiano' },
] as const;

const UNIT_OPTIONS: readonly Segment<UnitSystem>[] = [
  { value: 'metric', label: 'Metric' },
  { value: 'imperial', label: 'Imperial' },
];

export default function ProfileScreen() {
  const router = useRouter();
  const theme = useAppTheme();
  const bottomSpace = useTabContentBottom();
  const header = useScreenHeaderScroll();

  const name = useSettings((s) => s.profile.name);
  const heightCm = useSettings((s) => s.profile.heightCm);
  const birthYear = useSettings((s) => s.profile.birthYear);
  const unitSystem = useSettings((s) => s.unitSystem);
  const themeMode = useSettings((s) => s.themeMode);
  const language = useSettings((s) => s.language);
  const { t } = useT();
  const weeklyGoal = useSettings((s) => s.weeklyGoalWorkouts);
  const hapticsEnabled = useSettings((s) => s.hapticsEnabled);
  const update = useSettingsUpdate();

  // Four weeks: long enough that a week off does not zero the totals, short enough that a
  // change in behaviour shows up. The heatmap on Progress carries the long view.
  const summary = useTrainingSummary(4);
  const weeks = summary.data?.weeks;

  // Oldest-first array, so the current week is the last entry: see `useProgress.ts`.
  const thisWeek = weeks?.at(-1);
  const goalProgress = thisWeek === undefined ? 0 : thisWeek.workouts / Math.max(1, weeklyGoal);

  const totals = summary.data?.totals;
  const age = useMemo(() => new Date().getFullYear() - birthYear, [birthYear]);

  return (
    <View style={styles.root}>
      <CollapsibleHeader
        header={header}
        title="Profile"
        right={
          <BarAction
            icon="settings"
            label="Settings"
            onPress={() => router.push(routes.settings())}
          />
        }
      />

      <ScrollView
        onScroll={header.onScroll}
        scrollEventThrottle={16}
        contentContainerStyle={[styles.content, { paddingBottom: bottomSpace }]}
        keyboardShouldPersistTaps="handled"
      >
        <CollapsibleHero header={header} eyebrow={t('profile.eyebrow')} title={name || 'Athlete'}>
          <Row gap="md" align="center">
            <Avatar name={name} theme={theme} size={62} />
            <Stack gap="xxs" style={{ flex: 1, minWidth: 0 }}>
              <Txt variant="caption" tone="muted">
                {heightCm} cm · {age} {pluralWord(age, 'year', 'years')} old
              </Txt>
              <Txt variant="caption" tone="faint">
                {summary.isPending ? 'Loading history…' : trainingSince(summary.data)}
              </Txt>
            </Stack>
          </Row>
        </CollapsibleHero>

        <View style={styles.body}>
          {/* ---- The week, and the goal it is measured against ---------------- */}
          <Card padding="lg">
            <Row gap="lg" align="center">
              <ProgressRing
                progress={goalProgress}
                theme={theme}
                size={86}
                label={`${thisWeek?.workouts ?? 0}/${weeklyGoal}`}
                sublabel="this week"
              />
              <Stack gap="xs" style={{ flex: 1, minWidth: 0 }}>
                <Txt variant="subhead">{goalHeadline(thisWeek?.workouts ?? 0, weeklyGoal)}</Txt>
                <Txt variant="caption" tone="muted">
                  {thisWeek === undefined
                    ? 'Reading your history…'
                    : thisWeek.workouts >= weeklyGoal
                      ? `Goal met with ${countSessions(thisWeek.workouts - weeklyGoal)} to spare.`
                      : `${countSessions(weeklyGoal - thisWeek.workouts)} left to hit your weekly goal.`}
                </Txt>
                {summary.data !== undefined && summary.data.bestStreak > 0 ? (
                  <Badge
                    label={`Best streak ${summary.data.bestStreak} ${pluralWord(summary.data.bestStreak, 'day', 'days')}`}
                    tone="warning"
                    icon={<Icon name="flame" size={12} color={theme.colors.warning} />}
                  />
                ) : null}
              </Stack>
            </Row>
          </Card>

          <Card>
            <MetricGrid columns={2}>
              <Stat label="Sessions" value={formatNumber(totals?.workouts)} note="last 4 weeks" />
              <Stat
                label="Time"
                value={totals === undefined ? '-' : formatDurationCompact(totals.durationSeconds)}
                note="last 4 weeks"
              />
              <Stat
                label="Distance"
                value={totals === undefined ? '-' : formatDistance(totals.distanceMeters, unitSystem, 1)}
                note="run, ride, walk"
              />
              <Stat
                label="Volume"
                value={totals === undefined ? '-' : `${Math.round(totals.volumeKg / 1000)} t`}
                note="lifted"
              />
            </MetricGrid>
          </Card>

          {/* ---- Controls that change what this tab and the rest show --------- */}
          <SectionHeader title={t('profile.preferences')} />
          <Card padding="md">
            <Stack gap="lg">
              <Preference label={t('profile.units')} hint="Affects every distance, weight and pace in the app.">
                <SegmentedControl
                  segments={UNIT_OPTIONS}
                  value={unitSystem}
                  onChange={(next) => update({ unitSystem: next })}
                />
              </Preference>
              <Preference label={t('profile.appearance')} hint="Dark mode is a designed palette, not inverted colours.">
                <SegmentedControl
                  segments={THEME_OPTIONS}
                  value={themeMode}
                  onChange={(next) => update({ themeMode: next })}
                />
              </Preference>
              <Preference label={t('profile.language')} hint={t('settings.languageHint')}>
                <SegmentedControl
                  segments={LANGUAGE_OPTIONS}
                  value={language}
                  onChange={(next) => update({ language: next })}
                />
              </Preference>
              <Preference label={t('profile.weeklyGoal')} hint={`${weeklyGoal} ${pluralWord(weeklyGoal, 'session', 'sessions')} a week.`}>
                <GoalStepper value={weeklyGoal} onChange={(next) => update({ weeklyGoalWorkouts: next })} />
              </Preference>
            </Stack>
          </Card>

          {/* ---- Everything else --------------------------------------------- */}
          <SectionHeader title="Training" />
          <Card padding="xxs">
            <NavRow
              title="Progress & records"
              subtitle="Volume, frequency, distance, personal records"
              theme={theme}
              icon="trendUp"
              topDivider={false}
              onPress={() => router.push(routes.progress())}
            />
            <NavRow
              title="All activities"
              subtitle="Every session you have logged"
              theme={theme}
              icon="activities"
              showChevron={false}
              onPress={() => router.push(routes.workoutHistory())}
            />
            <NavRow
              title="Start a cardio session"
              subtitle="Run, ride or walk with GPS route tracking"
              theme={theme}
              icon="route"
              onPress={() => router.push(routes.cardio())}
            />
          </Card>

          <SectionHeader title="App" />
          <Card padding="xxs">
            <NavRow
              title="Training preferences"
              subtitle="Default rest, auto-start, speed vs. pace"
              theme={theme}
              icon="target"
              topDivider={false}
              onPress={() => router.push(routes.settingsTraining())}
            />
            <NavRow
              title="Notifications"
              subtitle={notificationsSubtitle(hapticsEnabled)}
              theme={theme}
              icon="bell"
              onPress={() => router.push(routes.settingsNotifications())}
            />
            <NavRow
              title="Permissions"
              subtitle="Location, notifications, motion"
              theme={theme}
              icon="lock"
              onPress={() => router.push(routes.permissions())}
            />
            <NavRow
              title="About Kinetiq"
              subtitle="Version, data, the exercise catalog"
              theme={theme}
              icon="info"
              showChevron={false}
              onPress={() => router.push(routes.settingsAbout())}
            />
          </Card>

          <View style={{ marginTop: spacing.xl }}>
            <Divider inset={spacing.sm} />
          </View>
          <Txt variant="micro" tone="faint" align="center" style={{ marginTop: spacing.md }}>
            Routines, history and settings live on this device. Only exercise search leaves it.
          </Txt>
        </View>
      </ScrollView>
    </View>
  );
}

/* ------------------------------------------------------------------ pieces -- */

function Stat({ label, value, note }: { label: string; value: string; note: string }) {
  const theme = useAppTheme();
  return (
    <Stack gap="xxs">
      {/* One line, shrunk to fit. These cells are half the screen wide and a value like
          "104.4 km" wraps at the space, which splits the number from its unit and pushes the
          label below it out of alignment with the cell beside it. A metric that has to wrap is
          a metric that should get smaller. */}
      <Txt
        variant="numeral"
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.75}
        style={{ color: theme.colors.text }}
      >
        {value}
      </Txt>
      <Txt variant="label" tone="muted">
        {label}
      </Txt>
      <Txt variant="micro" tone="faint">
        {note}
      </Txt>
    </Stack>
  );
}

/**
 * A label, its explanation, and the control beneath both.
 *
 * The hint is not decoration: "Units" is ambiguous between weight and distance, and a user
 * changing it to fix their pace display should be able to tell that this is the right knob
 * before they turn it.
 */
function Preference({
  label,
  hint,
  children,
}: {
  label: string;
  hint: string;
  children: React.ReactNode;
}) {
  return (
    <View style={{ gap: spacing.sm }}>
      <Txt variant="strong">{label}</Txt>
      <Txt variant="caption" tone="muted">
        {hint}
      </Txt>
      {children}
    </View>
  );
}

/**
 * Goal in steps of one, bounded at 14.
 *
 * A stepper rather than a slider: the value is an integer between 1 and 14, and a slider for
 * sixteen positions is a slider that cannot be set precisely by thumb.
 */
function GoalStepper({ value, onChange }: { value: number; onChange: (next: number) => void }) {
  const theme = useAppTheme();
  return (
    <Row gap="md" align="center">
      <IconButton
        name="minus"
        variant="surface"
        accessibilityLabel="Decrease weekly goal"
        disabled={value <= 1}
        onPress={() => onChange(Math.max(1, value - 1))}
      />
      <Txt variant="numeral" style={{ color: theme.colors.text, minWidth: 40 }} align="center">
        {value}
      </Txt>
      <IconButton
        name="plus"
        variant="surface"
        accessibilityLabel="Increase weekly goal"
        disabled={value >= 14}
        onPress={() => onChange(Math.min(14, value + 1))}
      />
    </Row>
  );
}

/* ------------------------------------------------------------------ helpers -- */

function goalHeadline(workouts: number, goal: number): string {
  if (workouts === 0) return 'Nothing logged this week';
  if (workouts >= goal) return 'Goal met';
  if (workouts >= goal / 2) return 'On track';
  return 'Getting started';
}

function countSessions(n: number): string {
  return `${n} ${pluralWord(n, 'session', 'sessions')}`;
}

function trainingSince(data: { totals: { workouts: number } } | undefined): string {
  if (data === undefined) return 'Exercise search runs against the wger catalog';
  return data.totals.workouts === 0
    ? 'No sessions logged yet: search the library to build your first routine'
    : 'Routines and history are stored on this device';
}

function formatNumber(value: number | undefined): string {
  return value === undefined ? '-' : String(value);
}

function notificationsSubtitle(hapticsEnabled: boolean): string {
  return `Rest timer, reminders${hapticsEnabled ? ', haptics on' : ', haptics off'}`;
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { paddingHorizontal: screenGutter },
  body: { paddingHorizontal: screenGutter, gap: spacing.lg },
});
