import { useRouter } from 'expo-router';
import { useCallback, useMemo } from 'react';
import { type MetaItem, useTabContentBottom } from '@/features/core/design-system';
import { routes } from '@/features/core/navigation';
import { type Language, type TKey, type TVars, useT } from '@/features/core/translations';
import type { UnitSystem } from '@/features/core/utils';
import { type GoalHeadline, goalHeadline } from '@/features/profile/domain/utils/goalCopy';
import { type ThemeMode, useSettings, useSettingsUpdate } from '@/features/settings';
import { useTrainingSummary } from '@/features/workouts';

/**
 * Segment copy as catalog KEYS, resolved in the hook: module scope has no language, and a
 * `label: 'System'` built at import time stays English when the user picks Italian.
 */
const THEME_OPTIONS: readonly { value: ThemeMode; label: TKey }[] = [
  { value: 'system', label: 'common.system' },
  { value: 'light', label: 'settings.light' },
  { value: 'dark', label: 'settings.dark' },
];

/**
 * `system` first, because it is the default and the one most people should leave alone. The
 * names are each written in their own language: someone who has the app in a language they
 * cannot read still has to find their own.
 */
const LANGUAGE_OPTIONS: readonly { value: Language; label: TKey }[] = [
  { value: 'system', label: 'common.system' },
  { value: 'en', label: 'settings.english' },
  { value: 'it', label: 'settings.italian' },
];

const UNIT_OPTIONS: readonly { value: UnitSystem; label: TKey }[] = [
  { value: 'metric', label: 'settings.metric' },
  { value: 'imperial', label: 'settings.imperial' },
];

const HEADLINES: Record<GoalHeadline, TKey> = {
  nothing: 'profileScreen.headlineNothing',
  goalMet: 'profileScreen.headlineGoalMet',
  onTrack: 'profileScreen.headlineOnTrack',
  starting: 'profileScreen.headlineStarting',
};

/**
 * Four weeks: long enough that a week off does not zero the totals, short enough that a change in
 * behaviour shows up. Home's grid carries the long view.
 */
const SUMMARY_WEEKS = 4;

const countSessions = (n: number, t: (key: TKey, vars?: TVars) => string) =>
  `${n} ${t('profileScreen.sessionWord', { count: n })}`;

/**
 * The Profile tab: identity, the week against its goal, the preferences that change what this
 * tab shows, and the way into the rest of the settings. Units, appearance and language live here
 * as controls, because changing units is something you do while looking at a number in the wrong
 * ones. The weekly goal is edited in Training settings only: one control for one number.
 */
export function useProfilePageLogic() {
  const { t } = useT();
  const router = useRouter();
  const bottomSpace = useTabContentBottom();
  const update = useSettingsUpdate();

  const name = useSettings(settings => settings.profile.name);
  const heightCm = useSettings(settings => settings.profile.heightCm);
  const birthYear = useSettings(settings => settings.profile.birthYear);
  const unitSystem = useSettings(settings => settings.unitSystem);
  const themeMode = useSettings(settings => settings.themeMode);
  const language = useSettings(settings => settings.language);
  const weeklyGoal = useSettings(settings => settings.weeklyGoalWorkouts);

  // NOTE: memoised on `t`: a fresh array every render would defeat `SegmentedControl`'s own memo,
  // and this screen re-renders on every settings change.
  const unitSegments = useMemo(() => UNIT_OPTIONS.map(o => ({ value: o.value, label: t(o.label) })), [t]);
  const themeSegments = useMemo(() => THEME_OPTIONS.map(o => ({ value: o.value, label: t(o.label) })), [t]);
  const languageSegments = useMemo(() => LANGUAGE_OPTIONS.map(o => ({ value: o.value, label: t(o.label) })), [t]);

  const summary = useTrainingSummary(SUMMARY_WEEKS);
  // NOTE: oldest first, so the current week is the last entry.
  const thisWeek = summary.data?.weeks.at(-1);
  const workouts = thisWeek?.workouts ?? 0;
  const bestStreak = summary.data?.bestStreak ?? 0;

  const age = useMemo(() => new Date().getFullYear() - birthYear, [birthYear]);
  const identity = useMemo<MetaItem[]>(
    () => [
      { icon: 'ruler', label: t('tabsProfile.height', { height: heightCm }) },
      { icon: 'profile', label: t('tabsProfile.age', { count: age }) },
    ],
    [age, heightCm, t],
  );

  const goalDetail =
    thisWeek === undefined
      ? t('profileScreen.readingHistory')
      : workouts >= weeklyGoal
        ? t('profileScreen.goalSpare', { phrase: countSessions(workouts - weeklyGoal, t) })
        : t('profileScreen.goalLeftText', { phrase: countSessions(weeklyGoal - workouts, t) });

  const setUnits = useCallback((next: UnitSystem) => update({ unitSystem: next }), [update]);
  const setTheme = useCallback((next: ThemeMode) => update({ themeMode: next }), [update]);
  const setLanguage = useCallback((next: Language) => update({ language: next }), [update]);
  const openEditor = useCallback(() => router.push(routes.editProfile()), [router]);
  const openTraining = useCallback(() => router.push(routes.settingsTraining()), [router]);
  const openNotifications = useCallback(() => router.push(routes.settingsNotifications()), [router]);
  const openData = useCallback(() => router.push(routes.settingsData()), [router]);
  const openAbout = useCallback(() => router.push(routes.settingsAbout()), [router]);

  return {
    state: { unitSystem, themeMode, language, bottomSpace },
    derived: {
      displayName: name || t('profileScreen.athlete'),
      identity,
      goalProgress: thisWeek === undefined ? 0 : workouts / Math.max(1, weeklyGoal),
      goalLabel: `${workouts}/${weeklyGoal}`,
      goalHeadline: t(HEADLINES[goalHeadline(workouts, weeklyGoal)]),
      goalDetail,
      bestStreakLabel:
        bestStreak > 0
          ? t('profileScreen.bestStreak', {
              count: bestStreak,
              word: t('profileScreen.dayWord', { count: bestStreak }),
            })
          : null,
      unitSegments,
      themeSegments,
      languageSegments,
    },
    effects: { setUnits, setTheme, setLanguage, openEditor, openTraining, openNotifications, openData, openAbout },
  };
}
