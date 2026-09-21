/**
 * Weekly bars: volume, distance, sessions.
 *
 * Drawn by victory-native on a Skia canvas rather than by hand. The hand-built version computed
 * its own scales and drew its own axis labels, and both were where the visible problems lived:
 * labels ran past the right edge because the last one was positioned from the bar's centre with
 * no measurement, and the plot had no domain padding, so a bar at the top of the range touched
 * the frame. A charting engine owns axes, ticks, domain padding and label collision; that is
 * the whole reason to use one.
 *
 * ## Props are unchanged
 *
 * Same contract as before, so the two call sites (Home, Workout) did not move. `format` still
 * belongs to the caller, because a chart should not know whether 1500 is kilograms or metres.
 *
 * ## Interaction
 *
 * `useChartPressState` gives the active index, and the readout is rendered in React Native above
 * the canvas rather than inside it: text in Skia needs a font object and cannot use the app's
 * type scale, and this label has to match the rest of the UI exactly.
 */
import { memo, useMemo, useState } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import {
  runOnJS,
  useAnimatedReaction,
  useDerivedValue,
  type SharedValue,
} from 'react-native-reanimated';
import { Bar, CartesianChart, useChartPressState } from 'victory-native';
import { useFont } from '@shopify/react-native-skia';

import InterMedium from '@expo-google-fonts/inter/500Medium/Inter_500Medium.ttf';
import { fontSize, radius, spacing } from '@/theme/tokens';
import type { Theme } from '@/theme/theme';
import { Txt } from '../Text';
import { EmptyChart } from './EmptyChart';

export type BarPoint = {
  /** Axis label, already formatted by the caller ("17 Aug", "Mon"). */
  label: string;
  value: number;
};

export const BarChart = memo(function BarChart({
  points,
  theme,
  width,
  height = 168,
  format,
  color,
  showAxes = true,
  showValueForLast = false,
  interactive = true,
  emptyLabel = 'Nothing logged yet',
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
  const font = useFont(InterMedium, fontSize.micro);
  const { state, isActive } = useChartPressState({ x: 0, y: { value: 0 } });

  // Victory wants a numeric x. The label is carried alongside and looked up for the axis, which
  // keeps the domain evenly spaced whatever the labels say.
  const data = useMemo(
    () => points.map((p, i) => ({ i, value: Number.isFinite(p.value) ? p.value : 0 })),
    [points],
  );
  const labels = useMemo(() => points.map((p) => p.label), [points]);

  const activeValue = useDerivedValue(() => state.y.value.value.value);
  const activeIndex = useDerivedValue(() => Math.round(state.x.value.value));

  if (points.length === 0) {
    return <EmptyChart height={height} label={emptyLabel} theme={theme} style={style} />;
  }

  const last = points[points.length - 1];

  return (
    <View style={[{ width, height: height + (showValueForLast ? spacing.xl : 0) }, style]}>
      {showValueForLast && last ? (
        // Inset from the right edge, not flush to it: the canvas below is inset by `padding`,
        // so a right-aligned label against the container edge sits outside the plot it labels
        // and gets clipped by the card.
        <Txt
          variant="caption"
          tone="muted"
          align="right"
          style={{ marginBottom: spacing.xs, paddingRight: spacing.xxl }}
        >
          {format(last.value)}
        </Txt>
      ) : null}
      <View style={{ flex: 1 }}>
        <CartesianChart
          data={data}
          xKey="i"
          yKeys={['value']}
          // The reason this file exists. `top` keeps the tallest bar off the frame, and the
          // horizontal padding keeps the first and last bars inside the plot instead of half
          // clipped by it.
          domainPadding={{ left: 20, right: 20, top: 18, bottom: 0 }}
          // `padding` is the chart's outer margin, and it is what stops the FIRST and LAST axis
          // labels running off the edge. `domainPadding` insets the bars within the plot but
          // leaves a label centred under the outermost bar hanging over the frame, which is how
          // the old chart came to render "Now" as "No".
          padding={{ left: 20, right: 26, top: 0, bottom: 0 }}
          // Bars are only honest from zero. The upper bound is left to the data.
          domain={{ y: [0] }}
          axisOptions={
            showAxes && font
              ? {
                  font,
                  lineColor: theme.colors.hairline,
                  labelColor: theme.colors.textFaint,
                  // One tick per bar, capped: six dated labels is the most that fits at caption
                  // size on a phone, and victory drops the rest rather than overlapping them.
                  tickCount: { x: Math.min(points.length, 6), y: 0 },
                  axisSide: { x: 'bottom', y: 'left' },
                  // No y axis at all. The value lives in the scrubber readout and in the card's
                  // own headline, so a column of numbers beside the bars is duplication that
                  // costs horizontal space the bars need.
                  formatXLabel: (v) => labels[Math.round(v)] ?? '',
                  formatYLabel: () => '',
                  lineWidth: { grid: { x: 0, y: 0 }, frame: 0 },
                }
              : undefined
          }
          {...(interactive ? { chartPressState: state } : {})}
        >
          {({ points: p, chartBounds }) => (
            <Bar
              points={p.value}
              chartBounds={chartBounds}
              color={fill}
              // A bar is a column with a rounded cap, not a pill: rounding the bottom of a
              // zero-based bar lifts it off its own baseline.
              roundedCorners={{ topLeft: radius.xs, topRight: radius.xs }}
              barCount={points.length}
              animate={{ type: 'timing', duration: 320 }}
            />
          )}
        </CartesianChart>
      </View>
      {interactive && isActive ? (
        <ActiveReadout
          index={activeIndex}
          value={activeValue}
          labels={labels}
          format={format}
          theme={theme}
        />
      ) : null}
    </View>
  );
});

/**
 * The scrubber readout, in React Native rather than Skia.
 *
 * Skia text needs a font object and cannot use `Txt`, so a readout drawn on the canvas would be
 * the one label in the app outside its own type scale.
 *
 * The bridge from the gesture to React is `useAnimatedReaction`, not a read of `.value` during
 * render. A shared value dereferenced in a render body is read off the UI thread at an
 * unspecified moment and does not schedule a re-render when it changes, so the readout would
 * show whatever the value happened to be on the last unrelated render.
 */
const ActiveReadout = memo(function ActiveReadout({
  index,
  value,
  labels,
  format,
  theme,
}: {
  index: SharedValue<number>;
  value: SharedValue<number>;
  labels: string[];
  format: (v: number) => string;
  theme: Theme;
}) {
  const [shown, setShown] = useState<{ i: number; v: number }>({ i: 0, v: 0 });
  useAnimatedReaction(
    () => ({ i: Math.round(index.value), v: value.value }),
    (next, prev) => {
      if (prev && next.i === prev.i && next.v === prev.v) return;
      runOnJS(setShown)(next);
    },
    [index, value],
  );

  return (
    <View pointerEvents="none" style={styles.readout}>
      <Txt variant="caption" weight="600" style={{ color: theme.colors.text }}>
        {`${labels[shown.i] ?? ''}  ${format(shown.v)}`}
      </Txt>
    </View>
  );
});

const styles = StyleSheet.create({
  readout: { position: 'absolute', top: 0, left: 0, right: 0, alignItems: 'center' },
});
