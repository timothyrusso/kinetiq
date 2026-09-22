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
import { useCallback, useMemo } from 'react';
import type { TKey, TVars } from '@/i18n';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTabContentBottom } from '@/ui/insets';

import { Icon } from '@/ui/icons';
import { SCROLL_INSETS, ScreenHeader } from '@/ui/Screen';
import { MetaLine, type MetaItem } from '@/ui/display';
import { HeaderToolbar, headerAction } from '@/navigation/HeaderAction';
import { Avatar, NavRow } from '@/ui/rows';
import { Badge, Card, MetricGrid, Row, SectionHeader } from '@/ui/layout';
import { SegmentedControl } from '@/ui/controls/SegmentedControl';
import { useT } from '@/i18n/useT';
import type { Language } from '@/i18n';
import { IconButton } from '@/ui/controls/IconButton';
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
} from '@/utils/format';
import type { UnitSystem } from '@/utils/format';
import type { ThemeMode } from '@/settings';


/**
 * Segment copy as catalog KEYS, resolved in the component.
 *
 * These live at module scope, where there is no language: a `label: 'System'` built at import
 * time is a label that stays English when the user picks Italian.
 */
const THEME_OPTIONS: readonly { value: ThemeMode; label: TKey }[] = [
  { value: 'system', label: 'common.system' },
  { value: 'light', label: 'settings.light' },
  { value: 'dark', label: 'settings.dark' },
];

/**
 * `system` first, because it is the default and the one most people should leave alone. The
 * names are each written IN their own language: someone who has the app in a language they
 * cannot read still has to find their own.
 */
const LANGUAGE_OPTIONS: readonly { value: Language; label: TKey }[] = [
  { value: 'system', label: 'common.system' },
  { value: 'en', label: 'settings.english' },
  { value: 'it', label: 'settings.italian' },
] as const;

const UNIT_OPTIONS: readonly { value: UnitSystem; label: TKey }[] = [
  { value: 'metric', label: 'settings.metric' },
  { value: 'imperial', label: 'settings.imperial' },
];

export default function ProfileScreen() {
  const router = useRouter();
  const theme = useAppTheme();
  const bottomSpace = useTabContentBottom();

  const name = useSettings((s) => s.profile.name);
  const heightCm = useSettings((s) => s.profile.heightCm);
  const birthYear = useSettings((s) => s.profile.birthYear);
  const unitSystem = useSettings((s) => s.unitSystem);
  const themeMode = useSettings((s) => s.themeMode);
  const language = useSettings((s) => s.language);
  const { t } = useT();

  // Segment labels are catalog KEYS in the tables above, resolved here and memoised on `t`:
  // a fresh array every render would defeat `SegmentedControl`'s own memo, and this screen
  // re-renders on every settings change.
  const unitSegments = useMemo(
    () => UNIT_OPTIONS.map((o) => ({ value: o.value, label: t(o.label) })),
    [t],
  );
  const themeSegments = useMemo(
    () => THEME_OPTIONS.map((o) => ({ value: o.value, label: t(o.label) })),
    [t],
  );
  const languageSegments = useMemo(
    () => LANGUAGE_OPTIONS.map((o) => ({ value: o.value, label: t(o.label) })),
    [t],
  );
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
  const openSettings = useCallback(() => router.push(routes.settings()), [router]);
  const identity = useMemo<MetaItem[]>(
    () => [
      {
        icon: 'ruler',
        label: t('profileScreen.ageLine', {
          height: heightCm,
          age,
          word: t('profileScreen.yearWord', { count: age }),
        }),
      },
      {
        icon: 'calendar',
        label: summary.isPending ? t('profileScreen.loadingHistory') : trainingSince(summary.data, t),
      },
    ],
    [age, heightCm, summary.data, summary.isPending, t],
  );

  return (
    <>
      <ScreenHeader title={t('tabs.profile')} />
      <HeaderToolbar placement="right">
        {headerAction({ action: 'settings', onPress: openSettings, t, label: 'profileScreen.settings' })}
      </HeaderToolbar>

      <ScrollView
        {...SCROLL_INSETS}
        contentContainerStyle={[styles.content, { paddingBottom: bottomSpace }]}
        keyboardShouldPersistTaps="handled"
      >
        <Row gap="md" align="center" style={styles.identity}>
          <Avatar name={name} theme={theme} size={62} />
          <Stack gap="xs" style={{ flex: 1, minWidth: 0 }}>
            <Txt variant="title" numberOfLines={1}>
              {name || t('profileScreen.athlete')}
            </Txt>
            <MetaLine items={identity} theme={theme} wrap />
          </Stack>
        </Row>

        <View style={styles.body}>
          {/* ---- The week, and the goal it is measured against ---------------- */}
          <Card padding="lg">
            <Row gap="lg" align="center">
              <ProgressRing
                progress={goalProgress}
                theme={theme}
                size={86}
                label={`${thisWeek?.workouts ?? 0}/${weeklyGoal}`}
                sublabel={t('profileScreen.thisWeekLabel')}
              />
              <Stack gap="xs" style={{ flex: 1, minWidth: 0 }}>
                <Txt variant="subhead">
                  {t(goalHeadline(thisWeek?.workouts ?? 0, weeklyGoal))}
                </Txt>
                <Txt variant="caption" tone="muted">
                  {thisWeek === undefined
                    ? t('profileScreen.readingHistory')
                    : thisWeek.workouts >= weeklyGoal
                      ? t('profileScreen.goalSpare', {
                          phrase: countSessions(thisWeek.workouts - weeklyGoal, t),
                        })
                      : t('profileScreen.goalLeftText', {
                          phrase: countSessions(weeklyGoal - thisWeek.workouts, t),
                        })}
                </Txt>
                {summary.data !== undefined && summary.data.bestStreak > 0 ? (
                  <Badge
                    label={t('profileScreen.bestStreak', {
                      count: summary.data.bestStreak,
                      word: t('profileScreen.dayWord', { count: summary.data.bestStreak }),
                    })}
                    tone="warning"
                    icon={<Icon name="flame" size={12} color={theme.colors.warning} />}
                  />
                ) : null}
              </Stack>
            </Row>
          </Card>

          <Card>
            <MetricGrid columns={2}>
              <Stat
                label={t('profileScreen.sessions')}
                value={formatNumber(totals?.workouts)}
                note={t('profileScreen.lastFourWeeks')}
              />
              <Stat
                label={t('profileScreen.time')}
                value={totals === undefined ? '-' : formatDurationCompact(totals.durationSeconds)}
                note={t('profileScreen.lastFourWeeks')}
              />
              <Stat
                label={t('profileScreen.distance')}
                value={
                  totals === undefined
                    ? '-'
                    : formatDistance(totals.distanceMeters, unitSystem, 1)
                }
                note={t('profileScreen.runRideWalk')}
              />
              <Stat
                label={t('profileScreen.volume')}
                value={totals === undefined ? '-' : `${Math.round(totals.volumeKg / 1000)} t`}
                note={t('profileScreen.lifted')}
              />
            </MetricGrid>
          </Card>

          {/* ---- Controls that change what this tab and the rest show --------- */}
          <SectionHeader title={t('profile.preferences')} />
          <Card padding="md">
            <Stack gap="lg">
              <Preference label={t('profile.units')} hint={t('profileScreen.unitsHint')}>
                <SegmentedControl
                  segments={unitSegments}
                  value={unitSystem}
                  onChange={(next) => update({ unitSystem: next })}
                />
              </Preference>
              <Preference
                label={t('profile.appearance')}
                hint={t('profileScreen.appearanceHint')}
              >
                <SegmentedControl
                  segments={themeSegments}
                  value={themeMode}
                  onChange={(next) => update({ themeMode: next })}
                />
              </Preference>
              <Preference label={t('profile.language')} hint={t('settings.languageHint')}>
                <SegmentedControl
                  segments={languageSegments}
                  value={language}
                  onChange={(next) => update({ language: next })}
                />
              </Preference>
              <Preference label={t('profile.weeklyGoal')} hint={t('profileScreen.goalHint')}>
                <GoalStepper
                  value={weeklyGoal}
                  onChange={(next) => update({ weeklyGoalWorkouts: next })}
                />
              </Preference>
            </Stack>
          </Card>

          {/* ---- Everything else --------------------------------------------- */}
          <SectionHeader title={t('profileScreen.training')} />
          <Card padding="xxs">
            <NavRow
              title={t('profileScreen.progressTitle')}
              subtitle={t('profileScreen.progressSubtitle')}
              theme={theme}
              icon="trendUp"
              topDivider={false}
              onPress={() => router.push(routes.progress())}
            />
            <NavRow
              title={t('profileScreen.allActivities')}
              subtitle={t('profileScreen.allActivitiesSubtitle')}
              theme={theme}
              icon="activities"
              showChevron={false}
              onPress={() => router.push(routes.workoutHistory())}
            />
            <NavRow
              title={t('profileScreen.startCardio')}
              subtitle={t('profileScreen.startCardioSubtitle')}
              theme={theme}
              icon="route"
              onPress={() => router.push(routes.cardio())}
            />
          </Card>

          <SectionHeader title={t('profileScreen.app')} />
          <Card padding="xxs">
            <NavRow
              title={t('profileScreen.trainingPrefs')}
              subtitle={t('profileScreen.trainingPrefsSubtitle')}
              theme={theme}
              icon="target"
              topDivider={false}
              onPress={() => router.push(routes.settingsTraining())}
            />
            <NavRow
              title={t('profileScreen.notifications')}
              subtitle={t('profileScreen.notificationsSubtitle', {
                haptics: t(
                  hapticsEnabled ? 'profileScreen.hapticsOn' : 'profileScreen.hapticsOff',
                ),
              })}
              theme={theme}
              icon="bell"
              onPress={() => router.push(routes.settingsNotifications())}
            />
            <NavRow
              title={t('profileScreen.permissions')}
              subtitle={t('profileScreen.permissionsSubtitle')}
              theme={theme}
              icon="lock"
              onPress={() => router.push(routes.permissions())}
            />
            <NavRow
              title={t('profileScreen.aboutTitle')}
              subtitle={t('profileScreen.aboutSubtitle')}
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
            {t('profileScreen.privacyNote')}
          </Txt>
        </View>
      </ScrollView>
    </>
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
  const { t } = useT();
  const theme = useAppTheme();
  return (
    <Row gap="md" align="center">
      <IconButton
        name="minus"
        variant="surface"
        accessibilityLabel={t('profileScreen.decreaseGoal')}
        disabled={value <= 1}
        onPress={() => onChange(Math.max(1, value - 1))}
      />
      <Txt variant="numeral" style={{ color: theme.colors.text, minWidth: 40 }} align="center">
        {value}
      </Txt>
      <IconButton
        name="plus"
        variant="surface"
        accessibilityLabel={t('profileScreen.increaseGoal')}
        disabled={value >= 14}
        onPress={() => onChange(Math.min(14, value + 1))}
      />
    </Row>
  );
}

/* ------------------------------------------------------------------ helpers -- */

/** The key for the week's headline. Translated by the caller, which has the `t`. */
function goalHeadline(workouts: number, goal: number): TKey {
  if (workouts === 0) return 'profileScreen.headlineNothing';
  if (workouts >= goal) return 'profileScreen.headlineGoalMet';
  if (workouts >= goal / 2) return 'profileScreen.headlineOnTrack';
  return 'profileScreen.headlineStarting';
}

function countSessions(n: number, t: (key: TKey, vars?: TVars) => string): string {
  return `${n} ${t('profileScreen.sessionWord', { count: n })}`;
}

function trainingSince(
  data: { totals: { workouts: number } } | undefined,
  t: (key: TKey, vars?: TVars) => string,
): string {
  if (data === undefined) return t('profileScreen.sinceUnknown');
  return t(data.totals.workouts === 0 ? 'profileScreen.sinceNone' : 'profileScreen.sinceSome');
}

function formatNumber(value: number | undefined): string {
  return value === undefined ? '-' : String(value);
}

const styles = StyleSheet.create({
  identity: { paddingHorizontal: screenGutter, paddingTop: spacing.md, paddingBottom: spacing.xl },
  content: { flexGrow: 1 },
  body: { paddingHorizontal: screenGutter, gap: spacing.lg },
});
