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
import { useCallback, useEffect, useMemo, useRef } from 'react';
import { Pressable, useWindowDimensions, type ViewStyle } from 'react-native';
import {
  clamp,
  createAnimatedComponent,
  type AnimatedStyle,
  Easing,
  ReduceMotion,
  runOnJS,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSpring,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { Gesture } from 'react-native-gesture-handler';
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
export const pressSpring = {
  damping: 26,
  stiffness: 320,
  mass: 0.85,
  reduceMotion: ReduceMotion.System,
} as const;

/** Things settling into place: sheets, expanding rows, snapping steppers. */
export const settleSpring = {
  damping: 24,
  stiffness: 220,
  mass: 1,
  reduceMotion: ReduceMotion.System,
} as const;

/** Overshoot for a confirmation that should feel like it lands with weight. */
export const popSpring = {
  damping: 14,
  stiffness: 200,
  mass: 1,
  reduceMotion: ReduceMotion.System,
} as const;

export const easeOut = Easing.out(Easing.cubic);
export const easeInOut = Easing.inOut(Easing.quad);

// ---------------------------------------------------------------------------
// Gesture-driven
// ---------------------------------------------------------------------------

/**
 * Drag-to-dismiss for a bottom sheet, as a ready RNGH gesture plus the styles to
 * apply. A sheet is then a `GestureDetector` and three lines, and every dismissable
 * surface in the app throws, settles and rubber-bands identically.
 *
 * Two rules separate this from a hand-rolled sheet:
 * - Upward drags rubber-band instead of stopping dead; a surface that will not move at
 *   all reads as broken rather than as locked.
 * - Release dismisses on offset *or* velocity, so a short flick closes it.
 *
 * `enabled` is a *value* rather than a `canDismiss()` callback on purpose: a worklet
 * cannot call a JS function, and a captured callback would silently go stale. Passing
 * a boolean rebuilds the gesture, so a sheet that is mid-edit can lock dismissal and
 * be certain the gesture sees the current answer.
 *
 * `onDismiss` is a JS function and the gesture body is a worklet, so the crossing uses
 * `runOnJS`: invoking a captured JS function directly from a worklet aborts the
 * process rather than throwing.
 */
export function useSheetDrag(options: {
  onDismiss: () => void;
  enabled?: boolean;
}) {
  const { onDismiss, enabled = true } = options;
  const translateY = useSharedValue(0);
  const startOffset = useRef(0);
  const { height: screenHeight } = useWindowDimensions();

  // Proportional but capped: 26 % of a 900 pt viewport is a long pull, and nobody
  // wants to drag a sheet 230 pt to close it on a tablet.
  const dismissOffset = Math.min(200, screenHeight * 0.26);

  const begin = useCallback(
    (current: number) => {
      startOffset.current = current;
    },
    [],
  );

  const drag = useCallback(
    (translationY: number) => {
      const raw = startOffset.current + translationY;
      // Pulling a sheet further up should feel tethered, not broken.
      translateY.value = raw < 0 ? raw * 0.26 : raw;
    },
    [startOffset, translateY],
  );

  const settle = useCallback(
    (dismiss: boolean) => {
      if (dismiss) {
        translateY.value = withTiming(
          screenHeight,
          { duration: motion.fast, easing: easeOut },
          () => onDismiss(),
        );
      } else {
        translateY.value = withSpring(0, settleSpring);
      }
    },
    [onDismiss, screenHeight, translateY],
  );

  const release = useCallback(
    (velocityY: number) => {
      const offset = translateY.value;
      settle(enabled && (velocityY > FLICK_VELOCITY || offset > dismissOffset));
    },
    [dismissOffset, enabled, settle, translateY],
  );

  // The worklet mirrors `drag`/`release` rather than calling them: those are JS
  // closures, and a worklet cannot call them. Both paths read the same constants.
  const gesture = useMemo(
    () =>
      Gesture.Pan()
        .onChange((event) => {
          'worklet';
          const raw = translateY.value + event.changeY;
          translateY.value = raw < 0 ? raw * RUBBER_BAND : raw;
        })
        .onEnd((event) => {
          'worklet';
          const offset = translateY.value;
          const dismiss =
            enabled && (offset > dismissOffset || event.velocityY > FLICK_VELOCITY);
          if (dismiss) {
            translateY.value = withTiming(
              screenHeight,
              { duration: motion.fast, easing: easeOut },
              (finished) => {
                'worklet';
                if (finished) runOnJS(onDismiss)();
              },
            );
          } else {
            translateY.value = withSpring(0, settleSpring);
          }
        }),
    [dismissOffset, enabled, onDismiss, screenHeight, translateY],
  );

  const style = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  /** Backing that fades as the sheet lifts off: a scrim that recedes with the sheet. */
  const backdropStyle = useAnimatedStyle(() => ({
    opacity: clamp(1 - translateY.value / 320, 0, 1),
  }));

  return { translateY, gesture, style, backdropStyle, begin, drag, release, dismissOffset };
}

const RUBBER_BAND = 0.26;
const FLICK_VELOCITY = 850;

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

// ---------------------------------------------------------------------------
// Indeterminate and ambient
// ---------------------------------------------------------------------------

/** Continuous rotation for an indeterminate spinner. */
export function useSpin(duration = 850): ReturnType<typeof useAnimatedStyle> {
  const angle = useSharedValue(0);
  useEffect(() => {
    angle.value = withRepeat(
      withTiming(Math.PI * 2, { duration, easing: Easing.linear }),
      -1,
      false,
    );
    return () => {
      angle.value = 0;
    };
  }, [angle, duration]);
  return useAnimatedStyle(() => ({ transform: [{ rotate: `${angle.value}rad` }] }));
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

// ---------------------------------------------------------------------------
// Entrances and content transitions
// ---------------------------------------------------------------------------

/**
 * Staggered entrance for the cards in a screen.
 *
 * `index` is clamped by `maxSteps`: on a 200-row list, a card below the fold
 * must not begin its animation after the user has already scrolled past it, so
 * steps beyond the eighth all start together. That keeps the stagger where it
 * reads as craft and stops it reading as lag.
 */
export function useEntrance(
  index: number,
  options: { stepMs?: number; distance?: number; maxSteps?: number; enabled?: boolean } = {},
): ReturnType<typeof useAnimatedStyle> {
  const { stepMs = 40, distance = 14, maxSteps = 7, enabled = true } = options;
  const reduced = useReducedMotion();
  const entered = useSharedValue(!enabled || reduced ? 1 : 0);
  useEffect(() => {
    if (!enabled || reduced) {
      entered.value = 1;
      return;
    }
    entered.value = withDelay(
      Math.min(index, maxSteps) * stepMs,
      withTiming(1, { duration: motion.base, easing: easeOut }),
    );
  }, [enabled, entered, index, maxSteps, reduced, stepMs]);
  return useAnimatedStyle(() => ({
    opacity: entered.value,
    transform: [{ translateY: (1 - entered.value) * distance }],
  }));
}

/**
 * Expands to a *measured* height. The caller measures with `onLayout` and hands
 * the number over, so the animation matches the content instead of a constant
 * that drifts the moment a translation makes the copy longer.
 */
export function useMeasuredExpand(measured: number, open: boolean) {
  const reduced = useReducedMotion();
  const height = useSharedValue(open ? measured : 0);
  useEffect(() => {
    const target = open ? measured : 0;
    height.value = reduced
      ? target
      : withTiming(target, { duration: motion.base, easing: easeOut });
  }, [height, measured, open, reduced]);
  return useAnimatedStyle(() => ({
    height: height.value,
    opacity: clamp(height.value / Math.max(1, measured), 0.2, 1),
  }));
}

/** Cross-fades between two states of the same slot, e.g. a chart's empty vs filled. */
export function useSwap(key: string | number, duration = motion.base) {
  const reduced = useReducedMotion();
  const progress = useSharedValue(reduced ? 1 : 0);
  useEffect(() => {
    progress.value = reduced ? 1 : 0;
    progress.value = withTiming(1, { duration, easing: easeOut });
  }, [duration, key, progress, reduced]);
  return useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ translateY: (1 - progress.value) * 6 }],
  }));
}

// ---------------------------------------------------------------------------
// Numeric
// ---------------------------------------------------------------------------

/**
 * Eases a number toward a target so a value the user reads: volume, a rep
 * count, the big distance readout mid-run: rolls instead of snapping.
 * Re-targeting mid-roll continues from wherever it is, which is what makes fast
 * edits feel physical rather than glitchy. Render it with `<Animated.Text>`.
 */
export function useRollingValue(initial = 0) {
  const value = useSharedValue(initial);
  const set = useCallback(
    (next: number) => {
      value.value = withTiming(next, { duration: motion.slow, easing: easeOut });
    },
    [value],
  );
  const snap = useCallback(
    (next: number) => {
      value.value = next;
    },
    [value],
  );
  return { value, set, snap };
}

/** Eased progress ring/Bar target: the primitive behind every chart. */
export function useEasedTarget(target: number, duration = motion.deliberate): SharedValue<number> {
  const reduced = useReducedMotion();
  const value = useSharedValue(reduced ? target : 0);
  useEffect(() => {
    value.value = reduced ? target : withTiming(target, { duration, easing: easeOut });
  }, [duration, reduced, target, value]);
  return value;
}

/**
 * Maps a shared value through a pure function into a style, with the mapping
 * memoised so a list row does not rebuild its worklet closure on each render.
 * The identity of `map` is the dependency that matters, so callers should pass a
 * `useCallback`-stable function when the list is long.
 */
export function useMappedStyle<T extends object>(
  source: SharedValue<number>,
  map: (t: number) => T,
): ReturnType<typeof useAnimatedStyle> {
  const stable = useMemo(() => map, [map]);
  return useAnimatedStyle(() => stable(source.value) as ViewStyle);
}
