/**
 * Motion primitives.
 *
 * Three rules, each because the alternative has a cost a user can feel.
 *
 * 1. Anything driven by a gesture or a scroll: a header collapsing, a sheet
 *    being dragged, the marker on a live run: is a *derived value* or an
 *    animated style reading a shared value, so the JS thread can be blocked by a
 *    network response and the animation still hits its frames.
 * 2. Nothing here animates `width`/`height` of content that has children to
 *    reflow, except `useMeasuredExpand`, which animates a height it has measured
 *    rather than one it guessed. Guessing a height is the usual failure of
 *    "expandable card" implementations.
 * 3. Reduced motion is honoured here, once. `ReduceMotion.System` handles the
 *    native side for springs and timings; `useReducedMotion` covers the cases
 *    where we must branch in JS: skipping a stagger, jumping to the end state.
 *    The information an animation carried still arrives; it arrives immediately.
 */
import { useCallback, useEffect } from 'react';
import { Pressable, type ViewStyle } from 'react-native';
import { createAnimatedComponent, type AnimatedStyle, Easing, ReduceMotion, useAnimatedStyle, useSharedValue, withDelay, withRepeat, withSpring, withTiming } from 'react-native-reanimated';
import { motion } from '@/theme/tokens';

// `clamp` comes from Reanimated, not `utils/functional`, and the difference is not style: every
// call site below is inside a worklet, which is serialised to a string and re-evaluated on the UI
// thread. A plain JS import is `undefined` there, `tsc` approves it, and the app throws
// "undefined is not a function" at the first scroll frame. Reanimated's is declared `'worklet'`.
// There is no JS-side `clamp` use in this file to reconcile against; if one is ever added, import
// the other one under a distinct name rather than swapping this one back.

// ---------------------------------------------------------------------------
// Shared physics vocabulary. One spring per *intent*, so the whole app has one
// physical language and tuning the feel of Kinetiq means editing this block.
// ---------------------------------------------------------------------------

/** Press feedback: fast enough to read as instant, damped so it never wobbles. */
const pressSpring = {
  damping: 26,
  stiffness: 320,
  mass: 0.85,
  reduceMotion: ReduceMotion.System,
} as const;

const easeOut = Easing.out(Easing.cubic);
const easeInOut = Easing.inOut(Easing.quad);

/**
 * Press feedback: a slight scale-down while held. Every tappable surface uses
 * this, so a button, a metric card and a routine row all feel like the same
 * material under a thumb.
 */
export function usePressScale(min = 0.976) {
  const pressed = useSharedValue(0);
  const style = useAnimatedStyle(() => ({
    transform: [{ scale: 1 - pressed.value * (1 - min) }],
  }));
  const onPressIn = useCallback(() => {
    pressed.value = withTiming(1, { duration: motion.instant, easing: easeOut });
  }, [pressed]);
  const onPressOut = useCallback(() => {
    pressed.value = withSpring(0, pressSpring);
  }, [pressed]);
  return { style, onPressIn, onPressOut, pressed };
}

/** Breathing opacity: the dot on a live-recording pill. */
export function usePulse(period = 1500, min = 0.32): AnimatedStyle<ViewStyle> {
  const phase = useSharedValue(0);
  useEffect(() => {
    phase.value = withRepeat(
      withTiming(1, { duration: period / 2, easing: easeInOut }),
      -1,
      true,
    );
    return () => {
      phase.value = 0;
    };
  }, [phase, period]);
  return useAnimatedStyle(() => ({ opacity: min + phase.value * (1 - min) }));
}

/**
 * A `Pressable` that accepts an `AnimatedStyle`. RN's own does not: its
 * `StyleProp<ViewStyle>` rejects reanimated's style handle, so handing `usePressScale`'s
 * output to a plain `Pressable` forces either a cast or a re-render per frame. One
 * wrapper, defined once, so no UI file has to re-wrap it.
 */
export const AnimatedPressable = createAnimatedComponent(Pressable);

/**
 * Skeleton shimmer. One shared value drives a translate across the whole
 * skeleton block, so a page of six placeholder rows costs one animation rather
 * than six: and they sweep together, which reads as one surface rather than a
 * pile of independent widgets.
 */
export function useShimmer(width: number, period = 1250) {
  const travel = useSharedValue(0);
  useEffect(() => {
    travel.value = 0;
    travel.value = withDelay(
      120,
      withRepeat(
        withTiming(1, { duration: period, easing: Easing.linear }),
        -1,
        false,
      ),
    );
    return () => {
      travel.value = 0;
    };
  }, [period, travel]);
  const style = useAnimatedStyle(() => ({
    transform: [{ translateX: -width + travel.value * width * 2 }],
  }));
  return style;
}
