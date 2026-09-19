/**
 * Sparkline — the smallest honest chart.
 *
 * No axes, no labels, no tooltip: it answers "up or down, and how jagged" in forty
 * pixels. Because nothing is read off it numerically, this is the one place a
 * smoothed curve belongs. `TrendChart` must show real vertices because a value is
 * being read from it; here the shape *is* the information, so Catmull-Rom is
 * legitimate and a straight polyline would just look broken at six points.
 */
import { memo, useEffect, useId, useMemo, useState } from 'react';
import {
  View,
  type LayoutChangeEvent,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import Svg, { Defs, LinearGradient, Path, Stop } from 'react-native-svg';
import Animated, {
  useAnimatedProps,
  useDerivedValue,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import { motion } from '@/theme/tokens';
import type { Theme } from '@/theme/theme';
import { easeOut } from '../animation';
import { areaPath, createScale, niceDomain, polylineLength, smoothPath } from './geometry';

const AnimatedPath = Animated.createAnimatedComponent(Path);

export const Sparkline = memo(function Sparkline({
  values,
  theme,
  width,
  height = 34,
  color,
  fill = true,
  strokeWidth = 2,
  animate = true,
  style,
}: {
  values: number[];
  theme: Theme;
  width: number;
  height?: number;
  /** Defaults to the accent; pass a metric's tone to match the number beside it. */
  color?: string;
  fill?: boolean;
  strokeWidth?: number;
  /** Off for sparklines inside a list — fifty entering at once is noise, not polish. */
  animate?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const stroke = color ?? theme.colors.accent;
  const reduced = useReducedMotion();
  // React's own unique id, because an SVG gradient id is document-scoped: two
  // sparklines on one screen with the same id would share whichever gradient the
  // renderer resolved first.
  const gradientId = useId().replace(/[^a-zA-Z0-9_-]/g, '');

  const { line, area, length } = useMemo(() => {
    // A single value becomes a two-point flat rule: an empty chart reads as a bug,
    // and a dot reads as a mistake, but a flat line reads as "unchanged" — true.
    const safe = values.length === 1 ? [values[0] ?? 0, values[0] ?? 0] : values;
    if (safe.length === 0 || width <= 0) return { line: '', area: '', length: 0 };
    const scale = createScale({
      count: safe.length,
      domain: niceDomain(safe, { includeZero: false }),
      width,
      height,
      inset: strokeWidth,
    });
    const pts = safe.map((v, i) => ({ x: scale.x(i), y: scale.y(v) }));
    return {
      line: smoothPath(pts),
      area: areaPath(pts, height),
      // Length comes from the *polyline*, which is always a little shorter than the
      // curve it approximates. Under-dashing is invisible; over-dashing leaves the
      // tail of the line permanently clipped.
      length: polylineLength(pts) + strokeWidth * 2,
    };
  }, [height, strokeWidth, values, width]);

  const progress = useSharedValue(animate && !reduced ? 0 : 1);
  const dashOffset = useDerivedValue(() => (1 - progress.value) * length);

  // Re-trace whenever the series changes shape, not only on mount: after a filter
  // change the data swaps underneath the same component, and an animation that only
  // ever ran once would freeze on a stale outline mid-transition.
  const shapeKey = `${width}x${height}:${line.length}`;
  useEffect(() => {
    progress.value =
      animate && !reduced
        ? withDelay(60, withTiming(1, { duration: motion.deliberate, easing: easeOut }))
        : withTiming(1, { duration: 0 });
  }, [animate, progress, reduced, shapeKey]);

  const dashProps = useAnimatedProps(
    () => ({
      strokeDasharray: `${length} ${length}`,
      strokeDashoffset: dashOffset.value,
    }),
    [length],
  );

  if (values.length === 0 || width <= 0) {
    // Reserve the space anyway: a chart that appears later shifts everything below it.
    return <View style={[{ width, height }, style]} />;
  }

  return (
    <View style={[{ width, height }, style]}>
      <Svg width={width} height={height} aria-hidden focusable={false}>
        {fill ? (
          <Defs>
            <LinearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={stroke} stopOpacity={0.28} />
              <Stop offset="1" stopColor={stroke} stopOpacity={0} />
            </LinearGradient>
          </Defs>
        ) : null}
        {fill ? <Path d={area} fill={`url(#${gradientId})`} /> : null}
        <AnimatedPath
          animatedProps={dashProps}
          d={line}
          stroke={stroke}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
      </Svg>
    </View>
  );
});

/**
 * Measures its own width so a chart can fill a card without the card doing the
 * arithmetic. State rather than a ref, because the path geometry is computed in JS and
 * the render has to wait for the measurement.
 *
 * The width is rounded: a sub-pixel layout difference otherwise recomputes every path
 * in the chart, which is the most common way a chart ends up re-rendering forever.
 */
export function useMeasuredWidth(): readonly [number, (e: LayoutChangeEvent) => void] {
  const [width, setWidth] = useState(0);
  const onLayout = (e: LayoutChangeEvent) => {
    const next = Math.round(e.nativeEvent.layout.width);
    setWidth((prev) => (prev === next ? prev : next));
  };
  return [width, onLayout] as const;
}

export type SparklineProps = React.ComponentProps<typeof Sparkline>;
