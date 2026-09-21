/**
 * How much empty space a scroll view must leave at its bottom.
 *
 * ## Why this is a module and not a number per screen
 *
 * It used to be a number per screen: fifteen separate `const BOTTOM_SPACE`, with the values
 * 48, 96, 108, 132 and 210, none of them derived from anything. They disagreed because they
 * were guesses, and the guesses aged differently — Home reserved 132 and never added
 * `insets.bottom`, so on any device with a home indicator its last card sat under the tab
 * bar, which is exactly what it looked like: the "Sessions over 8 weeks" heading with the
 * floating workout pill parked on top of it.
 *
 * Liquid Glass makes this worse in a way a solid bar hid. Content genuinely shows through
 * the material now, so a row that ends underneath the bar is not merely clipped — it is
 * visible, blurred, and looks like a rendering fault.
 *
 * So the space is computed from the things that actually occupy it: the bar's real height,
 * the device's safe area, the floating pill when a workout is running, and one unit of
 * breathing room so the last element is not flush against the chrome.
 */
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { spacing } from '@/theme/tokens';
import { useWorkoutRunning } from '@/workout/session';

/**
 * The tab bar's own height, excluding the safe area it sits above.
 *
 * Measured from the live tree rather than guessed: the native `TabBar` node reports
 * y=791 h=83 against an 874pt viewport, so 83 is the band it occupies INCLUDING the home
 * indicator's safe area. It is not the old hand-drawn 60 — a floating Liquid Glass capsule has
 * its own metrics — and it is not composed with `insets.bottom`, because the measurement
 * already contains it.
 */
export const TAB_BAR_HEIGHT = 83;

/**
 * Vertical room the floating "workout in progress" pill needs above the bar: its own height
 * plus the gap between it and the bar.
 */
export const WORKOUT_PILL_SPACE = 44 + spacing.sm;

/**
 * Bottom padding for a scroll view on one of the five TAB screens.
 *
 * Reserves the pill's space only while a workout is actually running — `useWorkoutRunning`
 * is a boolean store, so this re-renders on the transition and not on the per-second tick
 * that drives the pill's own timer.
 */
export function useTabContentBottom(extra = 0): number {
  const running = useWorkoutRunning();
  // The measured bar band, plus the bottom accessory when a workout is running (the system does
  // not account for the accessory), plus breathing room so the last row is not flush against
  // the glass. No `insets.bottom` term: TAB_BAR_HEIGHT already spans the home indicator.
  return TAB_BAR_HEIGHT + spacing.xl + (running ? WORKOUT_PILL_SPACE : 0) + extra;
}

/**
 * Bottom padding for a PUSHED screen — settings, a routine, an activity. No tab bar here:
 * these are stacked over the tabs, so reserving the bar's height would leave a visibly dead
 * band at the bottom of every one of them.
 */
export function useScreenContentBottom(extra = 0): number {
  const insets = useSafeAreaInsets();
  return insets.bottom + spacing.xxxl + extra;
}
