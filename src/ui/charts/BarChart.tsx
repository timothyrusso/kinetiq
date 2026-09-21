/**
 * Bar chart: weekly volume, monthly distance, sessions per week.
 *
 * Two rules make a bar chart honest, and both are enforced here rather than left to the
 * caller:
 *
 * 1. **Bars are zero-based, always.** A bar encodes a ratio against zero; clipping its
 *    base turns a 4% difference into a 300% one. `includeZero` exists as an escape hatch
 *    and nothing in the app uses it.
 *
 * 2. **Every bucket is drawn, including empty ones.** Callers pass data through
 *    `bucketize`, which materialises the gaps, so a quiet week shows a short stub on a
 *    real baseline instead of collapsing into its neighbour. A missing bar reads as a
 *    rendering bug; a zero stub on a baseline reads as "you did not train that week".
 *
 * The draw-on is one height grow for the whole series rather than a per-bar stagger:
 * 52 bars at 18ms each is a 900ms wait for the last one, which reads as lag, not polish.
 *
 * Plain views, not SVG: this chart is rectangles and two rules, so it stays inside
 * FlashList's recycling without paying for a drawing surface.
 */
import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useDerivedValue,
  useReducedMotion,
  useSharedValue,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { fontFamily, motion, radius } from '@/theme/tokens';
import type { Theme } from '@/theme/theme';
import { createScale, niceDomain } from './geometry';

const AnimatedView = Animated.createAnimatedComponent(View);
const AnimatedText = Animated.createAnimatedComponent(Text);

const HAIRLINE = 0.33;
const AXIS_LABEL_HEIGHT = 20;
const READOUT_WIDTH = 92;
const READOUT_HEIGHT = 28;
/** A zero bucket still gets a visible base so its slot is legible. */
const ZERO_STUB_HEIGHT = 3;
/** Below this the bars are hairlines; the number is the better presentation. */
const MIN_BAR_WIDTH = 3;

export type BarPoint = {
  label: string;
  value: number;
  /** Highlights a bar, "this week", "your PR week". */
  emphasised?: boolean;
  /** Anything the readout should add. */
  detail?: string;
};

export const BarChart = memo(function BarChart({
  points,
  theme,
  width,
  height = 156,
  format,
  color,
  showAxes = true,
  showValueForLast = false,
  includeZero = true,
  interactive = true,
  animate = true,
  emptyLabel = 'No data yet',
  style,
}: {
  points: BarPoint[];
  theme: Theme;
  width: number;
  height?: number;
  format: (value: number) => string;
  color?: string;
  showAxes?: boolean;
  /** Puts the last bar's value above it: the "so far this week" affordance. */
  showValueForLast?: boolean;
  includeZero?: boolean;
  interactive?: boolean;
  animate?: boolean;
  emptyLabel?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const fill = color ?? theme.colors.accent;
  const reduced = useReducedMotion();
  const axisHeight = showAxes ? AXIS_LABEL_HEIGHT : 0;
  const plotHeight = Math.max(0, height - axisHeight);
  const count = points.length;

  const [active, setActive] = useState<number | null>(null);
  const publish = useCallback(
    (index: number) => setActive((prev) => (prev === index ? prev : index)),
    [],
  );

  const reveal = useSharedValue(animate && !reduced ? 0 : 1);

  const shapeKey = `${width}x${plotHeight}:${count}:${points[0]?.label ?? ''}:${points[count - 1]?.label ?? ''}`;
  useEffect(() => {
    if (!animate || reduced) {
      reveal.value = 1;
      return;
    }
    reveal.value = withTiming(1, { duration: motion.deliberate, easing: Easing.linear });
  }, [animate, reduced, reveal, shapeKey]);

  // The stagger is arithmetic on one shared value rather than N shared values: a
  // `useSharedValue` per bar would be a hook called in a loop, and 52 of them would each
  // schedule their own timing. Spreading a single 0→1 ramp across the bars gives the same
  // left-to-right sweep, and caps the tail so a year of weeks still finishes inside ~650ms.
  const spread = count > 1 ? Math.min(0.4, 120 / motion.deliberate) : 0;
  const gap = count > 1 ? spread / (count - 1) : 0;
  const span = 1 - spread;

  const { scale, slot, barWidth } = useMemo(() => {
    const s = createScale({
      count,
      domain: niceDomain(points.map((p) => p.value), { includeZero }),
      width,
      height: plotHeight,
      paddingTop: showValueForLast ? 18 : 8,
      paddingBottom: 0,
    });
    const slotWidth = width / Math.max(1, count);
    return {
      scale: s,
      slot: slotWidth,
      // Wide slots get a proportionally wider gap, otherwise four bars read as four slabs.
      barWidth: Math.max(
        MIN_BAR_WIDTH,
        slotWidth <= 10 ? slotWidth - 2 : Math.min(slotWidth * 0.62, 34),
      ),
    };
  }, [count, includeZero, plotHeight, points, showValueForLast, width]);

  const gesture = useMemo(
    () =>
      Gesture.Pan()
        .maxPointers(1)
        // Horizontal drags read bars; a vertical drag is the page asking for its
        // scroll back. Without this pair the chart silently swallows scrolling on iOS.
        .activeOffsetX([-8, 8])
        .failOffsetY([-16, 16])
        .shouldCancelWhenOutside(false)
        .onStart((e) => {
          'worklet';
          const raw = slot > 0 ? Math.floor(e.x / slot) : 0;
          const last = Math.max(0, count - 1);
          runOnJS(publish)(raw < 0 ? 0 : raw > last ? last : raw);
        })
        .onUpdate((e) => {
          'worklet';
          const raw = slot > 0 ? Math.floor(e.x / slot) : 0;
          const last = Math.max(0, count - 1);
          runOnJS(publish)(raw < 0 ? 0 : raw > last ? last : raw);
        })
        .onFinalize(() => {
          'worklet';
          runOnJS(publish)(-1);
        }),
    [count, publish, slot],
  );

  if (count === 0 || width <= 0 || plotHeight < 24) {
    // The box stays reserved: a chart that shows up later shifts everything below it.
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

  const activePoint = active !== null && active >= 0 ? points[active] : undefined;
  // Both scale endpoints map to pixels; a bar's height is the distance from its own
  // value down to the zero line, never a raw value scaled by the container height.
  const zeroY = scale.y(Math.max(0, scale.domain[0]));

  return (
    <View style={[{ width, height }, style]}>
      {activePoint ? (
        <View
          pointerEvents="none"
          accessibilityLiveRegion="polite"
          accessibilityLabel={`${activePoint.label}: ${format(activePoint.value)}${activePoint.detail ? `, ${activePoint.detail}` : ''}`}
          style={{
            position: 'absolute',
            top: 0,
            left: clampCentered(
              slot * (active ?? 0) + slot / 2 - READOUT_WIDTH / 2,
              width - READOUT_WIDTH,
            ),
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

      <GestureDetector gesture={gesture}>
        <View
          accessible
          accessibilityRole={interactive ? 'adjustable' : 'image'}
          accessibilityLabel={`Bar chart, ${count} periods`}
          accessibilityHint={interactive ? 'Swipe across the chart to read each bar' : undefined}
          accessibilityValue={{
            min: 0,
            max: Math.max(0, count - 1),
            now: active ?? 0,
            text: activePoint ? `${activePoint.label}, ${format(activePoint.value)}` : undefined,
          }}
          style={{ width, height: plotHeight }}
        >
          {/* Baseline. A bar chart without a visible zero line asks the reader to guess
              where the bars start. */}
          <View
            pointerEvents="none"
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              top: zeroY,
              height: HAIRLINE,
              backgroundColor: theme.colors.chartGrid,
            }}
          />
          {points.map((p, i) => (
            <Bar
              // Position is the key, not the label: bucketized labels legitimately repeat
              // across year boundaries ("Jan"), and a duplicate key silently reuses the
              // wrong bar's animation.
              key={`b${i}`}
              index={i}
              value={p.value}
              emphasised={p.emphasised}
              active={active === i}
              slot={slot}
              barWidth={barWidth}
              zeroY={zeroY}
              valueTopY={scale.y(Math.max(0, p.value))}
              theme={theme}
              fill={fill}
              reveal={reveal}
              delay={i * gap}
              span={span}
              showValue={showValueForLast && i === count - 1}
              valueLabel={format(p.value)}
            />
          ))}
        </View>
      </GestureDetector>

      {showAxes ? (
        <View style={{ height: axisHeight, justifyContent: 'center' }}>
          <BarAxisLabels points={points} width={width} theme={theme} active={active} />
        </View>
      ) : null}
    </View>
  );
});

const Bar = memo(function Bar({
  index,
  value,
  emphasised,
  active,
  slot,
  barWidth,
  zeroY,
  valueTopY,
  theme,
  fill,
  reveal,
  delay,
  span,
  showValue,
  valueLabel,
}: {
  index: number;
  value: number;
  emphasised?: boolean;
  active: boolean;
  slot: number;
  barWidth: number;
  zeroY: number;
  valueTopY: number;
  theme: Theme;
  fill: string;
  reveal: SharedValue<number>;
  delay: number;
  span: number;
  showValue: boolean;
  valueLabel: string;
}) {
  const isZero = value <= 0;
  // Zero buckets animate to a stub rather than to nothing, so their slot is legible and
  // the reveal looks uniform across the series.
  const fullHeight = isZero ? ZERO_STUB_HEIGHT : Math.max(ZERO_STUB_HEIGHT, zeroY - valueTopY);

  const local = useDerivedValue(() => {
    const t = (reveal.value - delay) / span;
    const clamped = t < 0 ? 0 : t > 1 ? 1 : t;
    // Ease each bar's own slice so the sweep decelerates rather than shearing linearly.
    return clamped * clamped * (3 - 2 * clamped);
  }, [delay, reveal, span]);

  const barStyle = useAnimatedStyle(
    () => ({
      height: Math.max(0.5, fullHeight * local.value),
      opacity: 0.4 + 0.6 * local.value,
    }),
    [fullHeight, local],
  );

  // Declared unconditionally (a hook in a branch would change call order between
  // renders) and applied to the value label so it fades in with *its* bar rather than
  // with the series: the last bar reveals last, so a shared opacity would put the
  // number above an empty column.
  const labelStyle = useAnimatedStyle(() => ({ opacity: local.value }), [local]);

  return (
    <View
      pointerEvents="none"
      style={{
        position: 'absolute',
        left: index * slot + (slot - barWidth) / 2,
        top: 0,
        bottom: 0,
        width: barWidth,
        justifyContent: 'flex-end',
      }}
    >
      {showValue ? (
        <AnimatedText
          numberOfLines={1}
          style={[
            labelStyle,
            {
              // A computed top rather than `bottom: '100%'`: the label's offset parent is
              // the full-height column, so a percentage would park it above the plot.
              position: 'absolute',
              top: Math.max(0, valueTopY - 15),
              left: -barWidth,
              right: -barWidth,
              textAlign: 'center',
              fontFamily: fontFamily.semibold,
              fontSize: 11,
              color: theme.colors.textMuted,
            },
          ]}
        >
          {valueLabel}
        </AnimatedText>
      ) : null}
      <AnimatedView
        style={[
          barStyle,
          {
            borderRadius: barWidth / 2,
            backgroundColor: isZero
              ? theme.colors.border
              : emphasised || active
                ? fill
                : theme.colors.accentSoft,
          },
        ]}
      />
    </View>
  );
});

/**
 * Axis labels, thinned to what fits. Thinning always keeps the last label, because "what
 * about now" is the question a reader arrives with. Hidden labels keep their slot via
 * `opacity` so the visible ones never shift as the count changes.
 */
const BarAxisLabels = memo(function BarAxisLabels({
  points,
  width,
  theme,
  active,
}: {
  points: BarPoint[];
  width: number;
  theme: Theme;
  active: number | null;
}) {
  const maxLabels = Math.max(2, Math.floor(width / 46));
  const stride = Math.max(1, Math.ceil(points.length / maxLabels));
  const slot = width / Math.max(1, points.length);
  return (
    <View style={{ flexDirection: 'row' }}>
      {points.map((p, i) => {
        const shown = i % stride === 0 || i === points.length - 1;
        return (
          <Text
            // Same rule as the bars: position, because bucket labels can repeat.
            key={`l${i}`}
            numberOfLines={1}
            style={{
              width: slot,
              fontFamily: fontFamily.medium,
              fontSize: 10,
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

function clampCentered(v: number, max: number): number {
  const upper = Math.max(0, max);
  return v < 0 ? 0 : v > upper ? upper : v;
}

export type BarChartProps = React.ComponentProps<typeof BarChart>;
