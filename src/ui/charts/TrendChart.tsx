/**
 * The trend line: weekly minutes, distance, volume, and a session's heart rate or pace.
 *
 * victory-native on Skia, replacing a hand-built SVG chart. The hand-built one drew a
 * Catmull-Rom path and its own axis text, and the visible faults came from both halves: axis
 * labels were positioned from a point's x with no measurement, so the first and last ran past
 * the plot; the area gradient was clipped to the path's bounding box rather than the plot, so it
 * bled under the axis; and the scrubber read the nearest point by linear search on every touch
 * move.
 *
 * Props are unchanged, so all three call sites (Progress, and two on an activity detail) did
 * not move. `format` still belongs to the caller: this chart does not know whether 300 is
 * minutes, metres or beats.
 */
import { memo, useMemo, useState } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import {
  runOnJS,
  useAnimatedReaction,
  useDerivedValue,
  type SharedValue,
} from 'react-native-reanimated';
import { Area, CartesianChart, Line, useChartPressState } from 'victory-native';
import { Circle, useFont } from '@shopify/react-native-skia';

import InterMedium from '@expo-google-fonts/inter/500Medium/Inter_500Medium.ttf';
import { fontSize, spacing } from '@/theme/tokens';
import type { Theme } from '@/theme/theme';
import { withAlpha } from '@/utils/color';
import { Txt } from '../Text';
import { EmptyChart } from './EmptyChart';

export type TrendPoint = {
  /** Short axis label: "Mar", "Wk 12", "Mon". */
  label: string;
  value: number;
};

export const TrendChart = memo(function TrendChart({
  points,
  theme,
  width,
  height = 180,
  format,
  color,
  showAxes = true,
  includeZero = false,
  showDots = 'auto',
  interactive = true,
  emptyLabel = 'No data yet',
  style,
}: {
  points: TrendPoint[];
  theme: Theme;
  width: number;
  height?: number;
  /** Value to readout string. The caller owns units; the chart has no opinion. */
  format: (value: number) => string;
  color?: string;
  showGrid?: boolean;
  showAxes?: boolean;
  /** Line charts do not get bars-from-zero honesty, so this defaults off. */
  includeZero?: boolean;
  /**
   * `'auto'` draws dots up to roughly one per 25pt and hides them past that. Sixty dots on a
   * phone chart is noise.
   */
  showDots?: 'auto' | 'always' | 'never';
  interactive?: boolean;
  animate?: boolean;
  emptyLabel?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const stroke = color ?? theme.colors.accent;
  const font = useFont(InterMedium, fontSize.micro);
  const { state, isActive } = useChartPressState({ x: 0, y: { value: 0 } });

  const data = useMemo(
    () => points.map((p, i) => ({ i, value: Number.isFinite(p.value) ? p.value : 0 })),
    [points],
  );
  const labels = useMemo(() => points.map((p) => p.label), [points]);

  // One dot per ~25pt, which is the spacing at which they stop reading as a series and start
  // reading as texture.
  const dots = showDots === 'always' || (showDots === 'auto' && points.length <= width / 25);

  const activeValue = useDerivedValue(() => state.y.value.value.value);
  const activeIndex = useDerivedValue(() => Math.round(state.x.value.value));

  if (points.length === 0) {
    return <EmptyChart height={height} label={emptyLabel} theme={theme} style={style} />;
  }

  return (
    <View style={[{ width, height }, style]}>
      <CartesianChart
        data={data}
        xKey="i"
        yKeys={['value']}
        domainPadding={{ left: 12, right: 12, top: 20, bottom: 8 }}
        // `padding` is the outer margin and is what keeps the first and last axis LABELS inside
        // the frame. `domainPadding` insets the plotted points but leaves a label centred under
        // the outermost one hanging over the edge.
        padding={{ left: 16, right: 16, top: 0, bottom: 0 }}
        {...(includeZero ? { domain: { y: [0] } } : {})}
        {...(interactive ? { chartPressState: state } : {})}
        {...(showAxes && font
          ? {
              axisOptions: {
                font,
                labelColor: theme.colors.textFaint,
                tickCount: { x: Math.min(points.length, 5), y: 0 },
                axisSide: { x: 'bottom' as const, y: 'left' as const },
                formatXLabel: (v: number) => labels[Math.round(v)] ?? '',
                formatYLabel: () => '',
                // No grid and no frame. A fitness trend is read for its shape, and a ruled
                // background competes with the line for the eye at this size.
                lineWidth: { grid: { x: 0, y: 0 }, frame: 0 },
              },
            }
          : {})}
      >
        {({ points: p, chartBounds }) => (
          <>
            <Area
              points={p.value}
              y0={chartBounds.bottom}
              color={withAlpha(stroke, 0.16)}
              animate={{ type: 'timing', duration: 320 }}
              curveType="natural"
            />
            <Line
              points={p.value}
              color={stroke}
              strokeWidth={2.5}
              curveType="natural"
              animate={{ type: 'timing', duration: 320 }}
            />
            {dots
              ? p.value.map((pt, i) =>
                  pt.y === null ? null : (
                    <Circle key={i} cx={pt.x} cy={pt.y} r={3} color={stroke} />
                  ),
                )
              : null}
          </>
        )}
      </CartesianChart>
      {interactive && isActive ? (
        <TrendReadout
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
 * Bridged with `useAnimatedReaction`, not by reading `.value` in the render body: a shared value
 * dereferenced during render is sampled at an unspecified moment and schedules no re-render, so
 * the readout would lag the finger by however long until something else re-rendered.
 */
const TrendReadout = memo(function TrendReadout({
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
      <Txt variant="caption" tone="muted">
        {labels[shown.i] ?? ''}
      </Txt>
      <Txt variant="numeralSm" style={{ color: theme.colors.text }}>
        {format(shown.v)}
      </Txt>
    </View>
  );
});

const styles = StyleSheet.create({
  readout: {
    position: 'absolute',
    top: 0,
    left: spacing.md,
    right: spacing.md,
    alignItems: 'center',
  },
});
