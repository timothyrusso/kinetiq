/**
 * Trend chart — the interactive series chart on Home and Progress.
 *
 * Built around the one interaction that matters on a phone: press and slide to read a
 * value off the line. Everything else follows from that constraint.
 *
 * The scrubber is a manual gesture writing shared values, and only the marker and the
 * vertical rule read them. The series path is never rebuilt during a drag — redrawing a
 * 30-vertex path through React at 60fps is exactly the mistake this design avoids. The
 * readout *text* does have to cross back into JS to become a formatted string, so it
 * goes through `runOnJS`, fired on index change rather than per frame.
 *
 * Values are read from the vertices, never from an interpolated curve: if the finger is
 * between two weeks, the honest answer is one of those two weeks.
 *
 * The readout appears on gesture *activation*, roughly 8pt of horizontal travel, and
 * disappears when the finger lifts. A tap therefore does not leave the chart in a
 * changed state — which is the right trade: a readout that persists after a stray tap
 * on the way to a button would be worse than one that needs a small drag.
 */
import { memo, useCallback, useEffect, useId, useMemo, useState } from 'react';
import { Text, View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Circle, Defs, Line, LinearGradient, Path, Stop } from 'react-native-svg';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedProps,
  useDerivedValue,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import { fontFamily, motion, radius } from '@/theme/tokens';
import type { Theme } from '@/theme/theme';
import { easeOut } from '../animation';
import { clamp } from '@/utils/functional';
import {
  areaPath,
  createScale,
  gridValues,
  linePath,
  niceDomain,
  polylineLength,
  type Point,
} from './geometry';

const AnimatedPath = Animated.createAnimatedComponent(Path);
const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const AnimatedLine = Animated.createAnimatedComponent(Line);

const HAIRLINE = 0.33;
const AXIS_LABEL_HEIGHT = 20;
const READOUT_WIDTH = 92;
const READOUT_HEIGHT = 28;
/** Horizontal breathing room so the end dots and their markers are not clipped. */
const INSET = 12;
/** Below this the chart is decoration — show the empty state instead of a squiggle. */
const MIN_PLOT_HEIGHT = 28;

export type TrendPoint = {
  /** Short axis label: "Mar", "Wk 12", "Mon". */
  label: string;
  value: number;
  /** Anything the readout should add — "PR", "rest day", the raw duration. */
  detail?: string;
};

export const TrendChart = memo(function TrendChart({
  points,
  theme,
  width,
  height = 184,
  format,
  color,
  showGrid = true,
  showAxes = true,
  includeZero = false,
  showDots = 'auto',
  interactive = true,
  animate = true,
  emptyLabel = 'No data yet',
  style,
}: {
  points: TrendPoint[];
  theme: Theme;
  width: number;
  height?: number;
  /** Value → readout string. The caller owns units; the chart has no opinion. */
  format: (value: number) => string;
  color?: string;
  showGrid?: boolean;
  showAxes?: boolean;
  /** Line charts do not get bars-from-zero honesty, so this defaults off. */
  includeZero?: boolean;
  /**
   * `'auto'` draws dots up to roughly one per 25pt and hides them past that. Sixty dots
   * on a phone chart is noise, and each one is repainted on every active-state change.
   */
  showDots?: 'auto' | 'always' | 'never';
  interactive?: boolean;
  animate?: boolean;
  emptyLabel?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const stroke = color ?? theme.colors.accent;
  const reduced = useReducedMotion();
  const gradientId = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const axisHeight = showAxes ? AXIS_LABEL_HEIGHT : 0;
  const plotHeight = Math.max(0, height - axisHeight);
  const count = points.length;

  const { pts, scale, length } = useMemo(() => {
    const s = createScale({
      count,
      domain: niceDomain(points.map((p) => p.value), { includeZero }),
      width,
      height: plotHeight,
      inset: INSET,
      // The readout bubble floats above the plot; without this reserve, the highest
      // point's marker ends up drawn underneath its own label.
      paddingTop: 12,
      paddingBottom: 8,
    });
    const built: Point[] = points.map((p, i) => ({ x: s.x(i), y: s.y(p.value) }));
    return { pts: built, scale: s, length: polylineLength(built) + 4 };
  }, [count, includeZero, plotHeight, points, width]);

  const grid = useMemo(() => gridValues(scale.domain, 3), [scale.domain]);

  const [active, setActive] = useState<number | null>(null);
  // Draw-on completion is React state rather than a shared-value read during render:
  // touching `.value` there is a non-reactive read that appears to work right up until
  // the timing finishes and nothing ever re-renders.
  const [drawn, setDrawn] = useState(!animate || reduced);
  const progress = useSharedValue(animate && !reduced ? 0 : 1);
  const dashOffset = useDerivedValue(() => (1 - progress.value) * length, [length]);

  const shapeKey = `${width}x${plotHeight}:${count}:${points[0]?.label ?? ''}:${points[count - 1]?.value ?? ''}`;
  useEffect(() => {
    if (!animate || reduced) {
      progress.value = 1;
      setDrawn(true);
      return;
    }
    setDrawn(false);
    progress.value = withDelay(
      80,
      withTiming(1, { duration: motion.deliberate, easing: easeOut }),
    );
    const timer = setTimeout(() => setDrawn(true), 120 + motion.deliberate);
    return () => clearTimeout(timer);
  }, [animate, progress, reduced, shapeKey]);

  // Scrub position lives entirely in shared-value space; a drag only reaches React to
  // publish a *changed* index, so the readout text can be formatted.
  const scrubX = useSharedValue(-1);
  const scrubIndex = useSharedValue(-1);

  const publish = useCallback(
    (index: number) => setActive((prev) => (prev === index ? prev : index)),
    [],
  );
  const hide = useCallback(() => setActive((prev) => (prev === null ? prev : null)), []);

  const gesture = useMemo(() => {
    const step = scale.step;
    const last = Math.max(0, count - 1);
    // A plain number array crosses the worklet boundary cleanly; an array of objects
    // would be captured structurally on every frame.
    const xs = pts.map((p) => p.x);
    const indexAt = (x: number): number => {
      'worklet';
      const raw = step > 0 ? Math.round((x - INSET) / step) : 0;
      return raw < 0 ? 0 : raw > last ? last : raw;
    };
    return Gesture.Pan()
      .maxPointers(1)
      // Horizontal drags scrub; a vertical drag is the page asking for its scroll back.
      // Without this pair the chart silently swallows scrolling on iOS.
      .activeOffsetX([-8, 8])
      .failOffsetY([-16, 16])
      // A finger that slides past the chart edge keeps scrubbing the end point rather
      // than cancelling and dropping the readout mid-drag.
      .shouldCancelWhenOutside(false)
      // Activation, not `onBegin`. BEGIN fires for a plain touch-down, which means a
      // vertical scroll that happens to start on the chart would mount the readout
      // bubble and tear it down ~150ms later — a flicker on every pass over the card.
      // Waiting for activation costs nothing (the finger has moved 8pt either way) and
      // makes the scroll case structurally impossible rather than merely brief.
      .onStart((e) => {
        'worklet';
        const idx = indexAt(e.x);
        scrubIndex.value = idx;
        scrubX.value = xs[idx] ?? -1;
        runOnJS(publish)(idx);
      })
      .onUpdate((e) => {
        'worklet';
        const idx = indexAt(e.x);
        if (idx !== scrubIndex.value) {
          scrubIndex.value = idx;
          runOnJS(publish)(idx);
        }
        scrubX.value = xs[idx] ?? -1;
      })
      .onFinalize(() => {
        'worklet';
        scrubIndex.value = -1;
        scrubX.value = -1;
        runOnJS(hide)();
      });
  }, [count, hide, pts, publish, scale.step, scrubIndex, scrubX]);

  const dashProps = useAnimatedProps(
    () => ({ strokeDasharray: `${length} ${length}`, strokeDashoffset: dashOffset.value }),
    [length],
  );

  const markerProps = useAnimatedProps(
    () => {
      const i = scrubIndex.value;
      const p = i >= 0 ? pts[i] : undefined;
      return { cx: p?.x ?? -50, cy: p?.y ?? -50, opacity: p ? 1 : 0 };
    },
    [pts],
  );

  const ruleProps = useAnimatedProps(
    () => ({
      x1: scrubX.value,
      x2: scrubX.value,
      y1: 4,
      y2: plotHeight - 4,
      opacity: scrubX.value < 0 ? 0 : 1,
    }),
    [plotHeight],
  );

  if (count === 0 || width <= 0 || plotHeight < MIN_PLOT_HEIGHT) {
    // The box is still reserved: a chart that shows up later shifts everything below it.
    return (
      <View
        style={[
          { width, height: Math.max(height, 96), alignItems: 'center', justifyContent: 'center' },
          style,
        ]}
      >
        <Text
          style={{
            fontFamily: fontFamily.medium,
            fontSize: 13,
            color: theme.colors.textFaint,
            textAlign: 'center',
          }}
        >
          {emptyLabel}
        </Text>
      </View>
    );
  }

  const activePoint = active !== null ? points[active] : undefined;
  const showDotsNow =
    showDots === 'always' || (showDots === 'auto' && count <= Math.max(2, width / 25));
  const readoutLeft =
    active !== null
      ? clamp(scale.x(active) - READOUT_WIDTH / 2, 0, Math.max(0, width - READOUT_WIDTH))
      : 0;
  // The area has to close on the baseline of the *visible* domain, not on zero off-screen.
  const baselineY = scale.y(clamp(0, scale.domain[0], scale.domain[1]));

  const svg = (
    <Svg width={width} height={plotHeight} aria-hidden focusable={false}>
      <Defs>
        <LinearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={stroke} stopOpacity={0.3} />
          <Stop offset="0.72" stopColor={stroke} stopOpacity={0.05} />
          <Stop offset="1" stopColor={stroke} stopOpacity={0} />
        </LinearGradient>
      </Defs>

      {showGrid
        ? grid.map((g) => (
            <Line
              key={`g${g}`}
              x1={0}
              x2={width}
              y1={scale.y(g)}
              y2={scale.y(g)}
              stroke={theme.colors.chartGrid}
              strokeWidth={1}
              strokeDasharray="3 5"
            />
          ))
        : null}

      <Path d={areaPath(pts, baselineY)} fill={`url(#${gradientId})`} />

      <AnimatedPath
        animatedProps={dashProps}
        d={linePath(pts)}
        stroke={stroke}
        strokeWidth={2.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />

      {/* Dots wait for the line to finish drawing, or the chart looks like it is still
          assembling itself. */}
      {showDotsNow && drawn
        ? pts.map((p, i) => (
            <Circle
              key={`p${i}`}
              cx={p.x}
              cy={p.y}
              r={active === i ? 3.6 : 2.4}
              fill={active === i ? stroke : theme.colors.surfaceRaised}
              stroke={stroke}
              strokeWidth={active === i ? 2 : 1.6}
            />
          ))
        : null}

      <AnimatedLine
        animatedProps={ruleProps}
        stroke={theme.colors.textFaint}
        strokeWidth={1}
        strokeDasharray="2 4"
      />
      <AnimatedCircle
        animatedProps={markerProps}
        r={5}
        fill={stroke}
        stroke={theme.colors.surfaceRaised}
        strokeWidth={2.5}
      />
    </Svg>
  );

  return (
    <View style={[{ width, height }, style]}>
      {activePoint ? (
        /* A real RN view, not SVG text: it needs the app's font, its shadow, and to be
           announced by VoiceOver — none of which SVG text does well. */
        <View
          pointerEvents="none"
          accessibilityLiveRegion="polite"
          accessibilityLabel={`${activePoint.label}: ${format(activePoint.value)}${activePoint.detail ? `, ${activePoint.detail}` : ''}`}
          style={{
            position: 'absolute',
            top: 0,
            left: readoutLeft,
            width: READOUT_WIDTH,
            height: READOUT_HEIGHT,
            borderRadius: radius.md,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: theme.colors.surfaceRaised,
            borderWidth: HAIRLINE,
            borderColor: theme.colors.border,
            ...theme.shadows.raised,
          }}
        >
          <Text
            numberOfLines={1}
            style={{
              fontFamily: fontFamily.displayMedium,
              fontSize: 15,
              color: theme.colors.text,
            }}
          >
            {format(activePoint.value)}
          </Text>
        </View>
      ) : null}

      {interactive ? (
        <GestureDetector gesture={gesture}>
          <View
            accessible
            accessibilityRole="adjustable"
            accessibilityLabel={`Trend, ${count} points`}
            accessibilityHint="Swipe across the chart to read each value"
            accessibilityValue={{
              min: 0,
              max: Math.max(0, count - 1),
              now: active ?? 0,
              text: activePoint ? `${activePoint.label}, ${format(activePoint.value)}` : undefined,
            }}
          >
            {svg}
          </View>
        </GestureDetector>
      ) : (
        <View accessible accessibilityRole="image" accessibilityLabel={`Trend, ${count} points`}>
          {svg}
        </View>
      )}

      {showAxes ? (
        <View style={{ height: axisHeight, justifyContent: 'center' }}>
          <AxisLabels points={points} width={width} theme={theme} active={active} />
        </View>
      ) : null}
    </View>
  );
});

/**
 * Axis labels, thinned to what fits.
 *
 * Six labels on a 320px chart is four unreadable ones. Thinning always keeps the last
 * label, because "what about now" is the question a reader arrives with. Hidden labels
 * keep their slot via `opacity` so visible ones never shift as the count changes.
 */
const AxisLabels = memo(function AxisLabels({
  points,
  width,
  theme,
  active,
}: {
  points: TrendPoint[];
  width: number;
  theme: Theme;
  active: number | null;
}) {
  const maxLabels = Math.max(2, Math.floor(width / 62));
  const stride = Math.max(1, Math.ceil(points.length / maxLabels));
  return (
    <View style={{ flexDirection: 'row', paddingHorizontal: 2 }}>
      {points.map((p, i) => {
        const isLast = i === points.length - 1;
        const shown = i % stride === 0 || isLast;
        return (
          <Text
            key={`${p.label}-${i}`}
            numberOfLines={1}
            style={{
              flex: 1,
              fontFamily: fontFamily.medium,
              fontSize: 10.5,
              color: active === i ? theme.colors.text : theme.colors.chartAxis,
              textAlign: 'center',
              opacity: shown ? 1 : 0,
            }}
          >
            {p.label}
          </Text>
        );
      })}
    </View>
  );
});

export type TrendChartProps = React.ComponentProps<typeof TrendChart>;
