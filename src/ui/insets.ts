import { Platform } from 'react-native';
/**
 * How much empty space a scroll view must leave at its bottom.
 *
 * ## Why this is a module and not a number per screen
 *
 * It used to be a number per screen: fifteen separate `const BOTTOM_SPACE`, with the values
 * 48, 96, 108, 132 and 210, none of them derived from anything. They disagreed because they
 * were guesses, and the guesses aged differently, Home reserved 132 and never added
 * `insets.bottom`, so on any device with a home indicator its last card sat under the tab
 * bar, which is exactly what it looked like: the "Sessions over 8 weeks" heading with the
 * floating workout pill parked on top of it.
 *
 * Liquid Glass makes this worse in a way a solid bar hid. Content genuinely shows through
 * the material now, so a row that ends underneath the bar is not merely clipped: it is
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
 * The navigator's own compact header, excluding the top safe area.
 *
 * Only needed by screens whose header is TRANSPARENT: with an opaque one the navigator
 * already pushes content below the bar and the screen pads by nothing. A transparent bar
 * floats over full-bleed media, so the screen has to know how far down its first readable
 * row belongs.
 *
 * These are the platform's numbers, not a design choice: 44pt is the UIKit compact
 * navigation bar, 56pt the Material top app bar. Kept here so the two media screens cannot
 * drift apart, which is the rule the rest of this file exists for.
 */
const NATIVE_HEADER_HEIGHT = Platform.OS === 'ios' ? 44 : 56;

/**
 * Where the first readable content belongs under a TRANSPARENT header: the status bar plus the
 * bar itself. Opaque headers need nothing, because the navigator lays content out below them.
 */
export function useTransparentHeaderInset(): number {
  const insets = useSafeAreaInsets();
  return insets.top + NATIVE_HEADER_HEIGHT;
}

/**
 * Vertical room the floating "workout in progress" pill needs above the bar: its own height
 * plus the gap between it and the bar.
 */
export const WORKOUT_PILL_SPACE = 44 + spacing.sm;

/**
 * Bottom padding for a scroll view on one of the five TAB screens.
 *
 * Reserves the pill's space only while a workout is actually running, `useWorkoutRunning`
 * is a boolean store, so this re-renders on the transition and not on the per-second tick
 * that drives the pill's own timer.
 */
export function useTabContentBottom(extra = 0): number {
  const running = useWorkoutRunning();
  // The bar itself is covered by the system: a tab's list uses automatic content insets, which
  // include the tab bar and the home indicator. What is left is the bottom accessory while a
  // workout runs (the system does not account for it) and breathing room, so the last row is
  // not flush against the glass.
  return spacing.xl + (running ? WORKOUT_PILL_SPACE : 0) + extra;
}

/**
 * Bottom padding for a PUSHED screen: settings, a routine, an activity. No tab bar here:
 * these are stacked over the tabs, so reserving the bar's height would leave a visibly dead
 * band at the bottom of every one of them.
 */
export function useScreenContentBottom(extra = 0): number {
  const insets = useSafeAreaInsets();
  return screenContentBottom(insets.bottom, extra);
}

/**
 * The same number as `useScreenContentBottom`, from an inset the caller already has. For the
 * error screens, which can render above the `SafeAreaProvider` (the root layout's own error
 * boundary replaces the layout that mounts it), where the hook would throw.
 */
export function screenContentBottom(bottomInset: number, extra = 0): number {
  return bottomInset + spacing.xxxl + extra;
}
