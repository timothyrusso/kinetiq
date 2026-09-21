/**
 * Bottom tabs: the real one.
 *
 * `NativeTabs` renders a `UITabBarController` on iOS and a `BottomNavigationView` on Android,
 * so the bar is the platform's own rather than a drawn imitation of it. On iOS 26 that means
 * genuine Liquid Glass: the system material, its scroll-edge behaviour, the minimise-on-scroll
 * gesture and the tab-bar accessory slot: none of which can be reproduced by putting a glass
 * view behind five `Pressable`s, which is what this file used to do.
 *
 * ## What the custom bar was buying, and where each piece went
 *
 *  - The live-workout pill: now `NativeTabs.BottomAccessory`, which on iOS 26 is the same slot
 *    Apple Music puts its mini player in. It was previously a hand-positioned overlay, then an
 *    accessory inside a hand-drawn bar; this is the real thing.
 *  - The sliding accent indicator: gone, deliberately. The system bar has its own selection
 *    treatment, and a second indicator drawn on top would fight it.
 *  - Icons: SF Symbols on iOS and Material glyphs on Android, via one `Icon` carrying both, *    no icon-font dependency, since both sets are built into their platform. Every SF Symbol
 *    chosen here exists at or below iOS 16.0, this app's deployment target: `dumbbell` would
 *    have been the obvious pick for Workout and is iOS 17+, so it would render as a blank
 *    square on the floor of our support range.
 *
 * ## Content insets
 *
 * Every trigger sets `disableAutomaticContentInsets`, and the reason is consistency rather
 * than preference. `Screen` is shared with the pushed screens, which have no tab bar and
 * compute their own top padding from the safe area; left on, the system added its inset ON TOP
 * of that and every tab screen's content started ~86pt too low. Opting out keeps exactly one
 * code path for top insets across both kinds of screen. The bottom is then ours too, and
 * `useTabContentBottom` reserves the measured bar (83pt at this viewport) plus the accessory.
 */
import { NativeTabs } from 'expo-router/unstable-native-tabs';
// `Icon` and `Label` are the shared primitives, exported from the package root rather than
// from the native-tabs subpath.
import { Icon, Label, router } from 'expo-router';

import { routes } from '@/navigation/nav';
import { useAppTheme } from '@/theme/theme';
import { useT } from '@/i18n/useT';
import { ActiveWorkoutPill } from '@/ui/TabBar';
import { formatDuration } from '@/utils/format';
import { useWorkoutRunning, useWorkoutSession } from '@/workout/session';

export default function TabsLayout() {
  const theme = useAppTheme();
  const { t } = useT();
  const running = useWorkoutRunning();

  return (
    <NativeTabs
      // The app's accent, so the selected tab belongs to this product rather than to the
      // system default blue.
      tintColor={theme.colors.accent}
      // iOS 26: the bar shrinks to a pill as the user scrolls down and returns on scroll up.
      // This is the behaviour people now read as "a current iOS app".
      minimizeBehavior="onScrollDown"
    >
      <NativeTabs.Trigger name="index" disableAutomaticContentInsets>
        <Icon sf={{ default: 'house', selected: 'house.fill' }} md="home" />
        <Label>{t('tabs.home')}</Label>
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="activities" disableAutomaticContentInsets>
        {/* An ECG trace rather than a runner: this tab lists rides, walks and lifts too. */}
        <Icon sf="waveform.path.ecg" md="monitor_heart" />
        <Label>{t('tabs.activities')}</Label>
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="workout" disableAutomaticContentInsets>
        <Icon sf="figure.strengthtraining.traditional" md="fitness_center" />
        <Label>{t('tabs.workout')}</Label>
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="exercises" disableAutomaticContentInsets>
        <Icon sf={{ default: 'square.grid.2x2', selected: 'square.grid.2x2.fill' }} md="grid_view" />
        <Label>{t('tabs.exercises')}</Label>
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="profile" disableAutomaticContentInsets>
        <Icon sf={{ default: 'person', selected: 'person.fill' }} md="person" />
        <Label>{t('tabs.profile')}</Label>
      </NativeTabs.Trigger>

      {/* Mounted only while a workout is running. Returning `null` from inside the accessory is
          not enough: the slot itself still renders, and on iOS that is a full-width glass pill
          sitting over the tab bar. In dark mode it read as a light bar across the bottom of the
          screen with the tab labels hidden behind it. The boolean selector is what makes this
          cheap, since the session republishes every second while a workout runs. */}
      {running ? (
        <NativeTabs.BottomAccessory>
          <WorkoutAccessory />
        </NativeTabs.BottomAccessory>
      ) : null}
    </NativeTabs>
  );
}

/**
 * The live-workout pill, in the system's accessory slot.
 *
 * Its own component because the session republishes once a second while a workout runs; kept
 * inline, that tick would re-render the whole tab layout: and therefore the navigator: every
 * second. Split, the tick re-renders the pill and nothing else.
 */
function WorkoutAccessory() {
  const theme = useAppTheme();
  const { session } = useWorkoutSession();
  if (session === null || (session.status !== 'active' && session.status !== 'paused')) return null;
  return (
    <ActiveWorkoutPill
      label={session.routineName}
      detail={session.status === 'paused' ? 'Paused' : formatDuration(session.elapsedSeconds, ':')}
      onPress={() => {
        router.push(routes.workoutSession());
      }}
      theme={theme}
    />
  );
}
