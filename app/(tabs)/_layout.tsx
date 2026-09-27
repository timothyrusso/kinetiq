import { Icon, Label } from 'expo-router';
import { NativeTabs } from 'expo-router/unstable-native-tabs';
import { Platform } from 'react-native';
import { type Theme, useAppTheme } from '@/features/core/theme';
import { useT } from '@/features/core/translations';
import { useWorkoutRunning } from '@/features/workouts';
import { WorkoutAccessory } from '@/features/workouts/pages';

/**
 * Bottom tabs: the real one. `NativeTabs` renders a `UITabBarController` on iOS and a
 * `BottomNavigationView` on Android, so the bar is the platform's own: on iOS 26 that is genuine
 * Liquid Glass, its scroll-edge behaviour, the minimise-on-scroll gesture and the accessory slot.
 * The tint is the app's accent, so the selected tab belongs to this product.
 *
 * Icons are SF Symbols on iOS and Material glyphs on Android, both built into their platform;
 * every SF Symbol here exists at or below iOS 16.0, the deployment target (`dumbbell` is iOS 17+).
 * `accessibilityLabel` repeats the label on purpose: without it UIKit derives the spoken label from
 * the first title and keeps it, so after a language change VoiceOver kept the old language.
 *
 * The live-workout pill is `NativeTabs.BottomAccessory`, the slot Apple Music puts its mini player
 * in, mounted only while a workout runs: returning `null` inside it still renders the slot, a glass
 * pill over the bar. The boolean selector keeps this cheap while the session ticks every second.
 * Each tab is its own stack with the platform's large-title header (`TabStack`), and the system's
 * automatic content insets are on; `useTabContentBottom` adds the accessory's height.
 */
export default function TabsLayout() {
  const theme = useAppTheme();
  const { t } = useT();
  const running = useWorkoutRunning();

  return (
    <NativeTabs
      tintColor={theme.colors.accent}
      minimizeBehavior="onScrollDown"
      {...(Platform.OS === 'android' ? androidBar(theme) : {})}
    >
      <NativeTabs.Trigger name="(home)" accessibilityLabel={t('tabs.home')}>
        <Icon sf={{ default: 'house', selected: 'house.fill' }} md="home" />
        <Label>{t('tabs.home')}</Label>
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="workout" accessibilityLabel={t('tabs.workout')}>
        <Icon sf="figure.strengthtraining.traditional" md="fitness_center" />
        <Label>{t('tabs.workout')}</Label>
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="profile" accessibilityLabel={t('tabs.profile')}>
        <Icon sf={{ default: 'person', selected: 'person.fill' }} md="person" />
        <Label>{t('tabs.profile')}</Label>
      </NativeTabs.Trigger>

      {running ? (
        <NativeTabs.BottomAccessory>
          <WorkoutAccessory />
        </NativeTabs.BottomAccessory>
      ) : null}
    </NativeTabs>
  );
}

/**
 * The Android bar's colours, from the app's theme rather than the system's. Left to the defaults,
 * `BottomNavigationView` takes Material You's dynamic colours, which follow the system's light or
 * dark mode, not the app's: a pale bar under a dark screen. So the bar is the app's surface, the
 * selected tab is the accent pill with the ink that sits on the accent, the labels are always
 * shown, and the press ripple is off.
 */
function androidBar(theme: Theme) {
  const { colors } = theme;
  return {
    backgroundColor: colors.surface,
    indicatorColor: colors.accent,
    rippleColor: 'transparent',
    labelVisibilityMode: 'labeled',
    iconColor: { default: colors.textMuted, selected: colors.onAccent },
    labelStyle: { default: { color: colors.textMuted }, selected: { color: colors.text } },
  } as const;
}
