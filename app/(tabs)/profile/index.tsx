/**
 * Profile tab: identity, the week against its goal, the last four weeks, and the settings.
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
 * ## Structured, not sentences
 *
 * The identity line is a `MetaLine` of separate facts (height, age). Links out are rows with chevrons, all of them, the identity
 * block included: a row that navigates and shows no chevron reads as a row that does nothing.
 *
 * ## The name is the way into the profile editor
 *
 * Tapping the name and its facts opens the editor as a form sheet, the way a contacts card
 * opens its own edit form. The weekly goal is edited in Training settings only: one control
 * for one number.
 *
 * ## Streak and goal, not history
 *
 * Home carries the history and the load chart. This tab shows the two numbers that are about
 * the user rather than about a session: the week against the goal, and the best streak.
 */
import { useCallback, useMemo } from 'react';
import type { TKey, TVars } from '@/i18n';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTabContentBottom } from '@/ui/insets';

import { Icon } from '@/ui/icons';
import { SCROLL_INSETS, ScreenHeader } from '@/ui/Screen';
import { MetaLine, type MetaItem } from '@/ui/display';
import { NavRow } from '@/ui/rows';
import { Badge, Card, Row } from '@/ui/layout';
import { SectionHeader } from '@/ui/display';
import { SegmentedControl } from '@/ui/controls/SegmentedControl';
import { AccentPreference } from '@/ui/AccentPicker';
import { useT } from '@/i18n/useT';
import type { Language } from '@/i18n';
import { ProgressRing } from '@/ui/charts/ProgressRing';
import { Txt } from '@/ui/Text';
import { Divider, Stack } from '@/ui/layout';
import { useTrainingSummary } from '@/queries/useProgress';
import { useSettings, useSettingsUpdate } from '@/settings';
import { routes } from '@/navigation/nav';
import { useAppTheme } from '@/theme/theme';
import { spacing, screenGutter } from '@/theme/tokens';
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
  const update = useSettingsUpdate();

  // Four weeks: long enough that a week off does not zero the totals, short enough that a
  // change in behaviour shows up. Home's load chart carries the long view.
  const summary = useTrainingSummary(4);
  const weeks = summary.data?.weeks;

  // Oldest-first array, so the current week is the last entry: see `useProgress.ts`.
  const thisWeek = weeks?.at(-1);
  const goalProgress = thisWeek === undefined ? 0 : thisWeek.workouts / Math.max(1, weeklyGoal);

  const age = useMemo(() => new Date().getFullYear() - birthYear, [birthYear]);
  const openEditor = useCallback(() => router.push(routes.editProfile()), [router]);
  const identity = useMemo<MetaItem[]>(
    () => [
      { icon: 'ruler', label: t('tabsProfile.height', { height: heightCm }) },
      { icon: 'profile', label: t('tabsProfile.age', { count: age }) },
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

      <ScrollView
        {...SCROLL_INSETS}
        contentContainerStyle={[styles.content, { paddingBottom: bottomSpace }]}
        keyboardShouldPersistTaps="handled"
      >
        <Pressable
          onPress={openEditor}
          accessibilityRole="button"
          accessibilityLabel={name || t('profileScreen.athlete')}
          accessibilityHint={t('profileScreen.editProfileHint')}
          style={({ pressed }) => [styles.identity, pressed ? { opacity: 0.6 } : null]}
        >
          <Row gap="md" align="center">
            <Stack gap="xs" style={{ flex: 1, minWidth: 0 }}>
              <Txt variant="title" numberOfLines={1}>
                {name || t('profileScreen.athlete')}
              </Txt>
              <MetaLine items={identity} theme={theme} wrap />
            </Stack>
            <Icon name="chevronRight" size={18} color={theme.colors.textFaint} />
          </Row>
        </Pressable>

        <View style={styles.body}>
          {/* ---- The week, and the goal it is measured against ---------------- */}
          <Card padding="lg">
            <Row gap="lg" align="center">
              {/* Only the count inside the ring: "this week" in there overflowed the circle
                  at the ring's size, so it is the eyebrow over the headline instead. */}
              <ProgressRing
                progress={goalProgress}
                theme={theme}
                size={86}
                label={`${thisWeek?.workouts ?? 0}/${weeklyGoal}`}
              />
              <Stack gap="xs" style={{ flex: 1, minWidth: 0 }}>
                <Txt variant="micro" tone="faint" uppercase tracking={1.1}>
                  {t('profileScreen.thisWeekLabel')}
                </Txt>
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

          {/* ---- Controls that change what this tab and the rest show --------- */}
          <SectionHeader title={t('profile.preferences')} style={styles.section} />
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
              {/* Android only: renders nothing on iOS, where the brand accent stays. */}
              <AccentPreference />
            </Stack>
          </Card>

          {/* ---- Everything else --------------------------------------------- */}
          <SectionHeader title={t('profileScreen.app')} style={styles.section} />
          <Card padding="xxs">
            <NavRow
              title={t('profileScreen.trainingPrefs')}
              description={t('profileScreen.trainingPrefsSubtitle')}
              theme={theme}
              icon="target"
              topDivider={false}
              onPress={() => router.push(routes.settingsTraining())}
            />
            <NavRow
              title={t('profileScreen.notifications')}
              description={t('profileScreen.notificationsSubtitle')}
              theme={theme}
              icon="bell"
              onPress={() => router.push(routes.settingsNotifications())}
            />
            <NavRow
              title={t('profileScreen.aboutTitle')}
              description={t('profileScreen.aboutSubtitle')}
              theme={theme}
              icon="info"
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

/**
 * A label, its explanation, and the control beneath both.
 *
 * The hint is not decoration: it says what the control changes before the user turns it.
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


const styles = StyleSheet.create({
  identity: { paddingHorizontal: screenGutter, paddingTop: spacing.md, paddingBottom: spacing.xl },
  content: { flexGrow: 1 },
  body: { paddingHorizontal: screenGutter, gap: spacing.md },
  // Sections are a step further apart than blocks inside one.
  section: { marginTop: spacing.lg, marginBottom: 0 },
});
