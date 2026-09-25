/**
 * Progress ring: weekly goal, goal completion, a single session's target.
 *
 * The arc is regenerated per frame through `useAnimatedProps` rather than drawn as a
 * dashed circle. The two look identical; the path version is the one that also supports a
 * dial that is not a full turn, and it is the same code path: so there is no reason to
 * take the dasharray shortcut.
 *
 * The inner label fades in on the *ring's own* shared value instead of doing a numeric
 * count-up. That is a deliberate trade, not an omission: reanimated cannot write a
 * formatted string into `Text` children, so a real count-up means bridging to JS and
 * re-rendering React every time the number changes. A number that appears *with* the arc
 * never contradicts it, and it costs nothing. If a count-up is ever genuinely wanted, the
 * right way is a per-digit column of `<Animated.Text>` translated on Y, not a bridge.
 */
import { memo, useEffect } from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import Animated, {
  Easing,
  useAnimatedProps,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { fontFamily } from '@/theme/tokens';
import type { Theme } from '@/theme/theme';
import { clamp01 } from './geometry';
import { useT } from '@/i18n/useT';

const AnimatedPath = Animated.createAnimatedComponent(Path);

export const ProgressRing = memo(function ProgressRing({
  progress,
  theme,
  size = 88,
  strokeWidth,
  color,
  trackColor,
  cap = 'round',
  label,
  sublabel,
  animate = true,
  style,
}: {
  /**
   * 0→1. Values above 1 clamp: an over-achieved goal gets a full ring, and the caller
   * puts "118%" in `label` where the number itself is the point.
   */
  progress: number;
  theme: Theme;
  size?: number;
  /** Defaults to a ratio of `size`, which keeps small rings from looking heavy. */
  strokeWidth?: number;
  color?: string;
  trackColor?: string;
  cap?: 'round' | 'butt';
  /** Text inside the ring. Omit it and the ring is purely decorative. */
  label?: string;
  sublabel?: string;
  animate?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const { t } = useT();
  const reduced = useReducedMotion();
  const stroke = color ?? theme.colors.accent;
  const track = trackColor ?? theme.colors.hairline;
  const thickness = strokeWidth ?? Math.max(5, Math.round(size * 0.085));
  const target = clamp01(progress);
  const radius = (size - thickness) / 2;
  const centre = size / 2;
  // Below this, inner text is unreadable at any size that is not clipped.
  const compact = size < 64;

  const value = useSharedValue(animate && !reduced ? 0 : target);
  useEffect(() => {
    value.value =
      animate && !reduced
        ? withTiming(target, { duration: 720, easing: Easing.out(Easing.exp) })
        : target;
  }, [animate, reduced, target, value]);

  // The track is a hair under a full turn: a single SVG arc command cannot close a
  // circle (start and end coincide, so the renderer draws nothing), and `sweepTo`
  // already caps at 0.9999 for exactly this reason. Same colour as the arc's seam,
  // so the gap is not visible.
  const trackProps = useAnimatedProps(
    () => ({ d: arcFromTurns(centre, radius, 0, 0.9999) }),
    [centre, radius],
  );

  const arcProps = useAnimatedProps(
    () => ({ d: arcFromTurns(centre, radius, 0, value.value) }),
    [centre, radius, value],
  );

  const labelStyle = useAnimatedStyle(() => ({ opacity: 0.25 + 0.75 * value.value }), [value]);

  const showText = Boolean(label || sublabel);

  return (
    <View
      style={[{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }, style]}
      accessible
      accessibilityRole="summary"
      accessibilityLabel={
        label
          ? `${label}${sublabel ? `, ${sublabel}` : ''}`
          : t('followups.ringA11y', { percent: Math.round(target * 100) })
      }
    >
      <Svg width={size} height={size} aria-hidden focusable={false} style={StyleSheet.absoluteFill}>
        <AnimatedPath
          animatedProps={trackProps}
          stroke={track}
          strokeWidth={thickness}
          strokeLinecap="butt"
          fill="none"
        />
        <AnimatedPath
          animatedProps={arcProps}
          stroke={stroke}
          strokeWidth={thickness}
          strokeLinecap={cap}
          fill="none"
        />
      </Svg>

      {showText ? (
        <View pointerEvents="none" style={{ alignItems: 'center' }}>
          {label ? (
            <Animated.Text
              numberOfLines={1}
              style={[
                labelStyle,
                {
                  fontFamily: fontFamily.displayMedium,
                  // Scales with the ring so a 56pt ring and a 140pt ring are both
                  // "the number in the middle" rather than needing per-call sizes.
                  fontSize: size * (compact ? 0.28 : 0.24),
                  color: theme.colors.text,
                },
              ]}
            >
              {label}
            </Animated.Text>
          ) : null}
          {sublabel && !compact ? (
            <Text
              numberOfLines={1}
              style={{
                fontFamily: fontFamily.medium,
                fontSize: Math.max(9, size * 0.115),
                color: theme.colors.textFaint,
                marginTop: 1,
              }}
            >
              {sublabel}
            </Text>
          ) : null}
        </View>
      ) : null}
    </View>
  );
});

// ---------------------------------------------------------------------------
// Worklet-local geometry
// ---------------------------------------------------------------------------

/**
 * The arc maths, again, deliberately.
 *
 * `arcPath`/`sweepTo`/`clamp01` in `geometry.ts` are the canonical implementation and stay
 * canonical for everything rendered on the JS thread, `ringArc` above, the single-ring path,
 * the heatmap. These three exist because a worklet is stringified and re-evaluated on the UI
 * thread, where it can only reach functions from *its own module* or from a package Reanimated
 * whitelists. Importing the shared ones fails twice over, and the two failures look unrelated:
 * unmarked, they are `undefined` on the UI thread; marked `'worklet'`, they become Remote
 * Functions and throw "Tried to synchronously call a Remote Function" the moment a worklet calls
 * one synchronously. Neither is visible to `tsc`, and both only surface once a ring animates.
 *
 * The duplication is bounded and checkable: same 6 lines, same rounding, no policy in them.
 */
function arcFromTurns(centre: number, radius: number, fromTurn: number, toTurn: number): string {
  'worklet';
  const clamp = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v);
  const r = (v: number): number => Math.round(v * 100) / 100;
  // 0.9999 of a turn, not 1: a single SVG arc command cannot close a circle: start and end
  // coincide and the renderer draws nothing.
  const sweep = (t: number): number => -Math.PI / 2 + Math.min(clamp(t), 0.9999) * Math.PI * 2;
  const a = sweep(fromTurn);
  const b = sweep(toTurn);
  const sx = centre + radius * Math.cos(a);
  const sy = centre + radius * Math.sin(a);
  const ex = centre + radius * Math.cos(b);
  const ey = centre + radius * Math.sin(b);
  const large = Math.abs(b - a) > Math.PI ? 1 : 0;
  return `M${r(sx)} ${r(sy)} A${r(radius)} ${r(radius)} 0 ${large} 1 ${r(ex)} ${r(ey)}`;
}
