/**
 * One series as a line: a value per session, oldest on the left.
 *
 * `react-native-svg`, measured rather than assumed: the plot takes the width its container
 * lays out to, so it cannot run past a card's edge the way a chart handed a screen width does.
 * Until the first layout there is no width, and the slot keeps its height so the card does not
 * jump when the line arrives.
 *
 * Static on purpose. There is no scrubber: the numbers a lifter reads off this chart (the
 * latest weight, the best, the first) are printed around it, and the line is there for the
 * shape between them. The caller owns units through `format`.
 */
import { memo, useMemo } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Circle, Line, Path } from 'react-native-svg';

import { spacing } from '@/theme/tokens';
import type { Theme } from '@/theme/theme';
import { Txt } from '../Text';
import { useMeasuredWidth } from './useMeasuredWidth';

export type LinePoint = {
  /** Stable per point (the session's id). */
  key: string;
  /** Under the first and last points: "3 Mar". */
  label: string;
  value: number;
};

/** Room for a dot's radius at the plot's edges, so the first and last dots are not clipped. */
const EDGE = 6;
const DOT = 3;
/** Past roughly one dot per 18pt the dots stop reading as sessions and start reading as texture. */
const DOT_SPACING = 18;

export const LineChart = memo(function LineChart({
  points,
  theme,
  height = 140,
  format,
  accessibilityLabel,
  color,
  style,
}: {
  points: readonly LinePoint[];
  theme: Theme;
  height?: number;
  format: (value: number) => string;
  accessibilityLabel: string;
  color?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const [width, onLayout] = useMeasuredWidth();
  const stroke = color ?? theme.colors.accent;

  const geometry = useMemo(() => {
    if (width === 0 || points.length === 0) return null;
    const values = points.map((p) => p.value);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const span = max - min;
    const innerW = width - EDGE * 2;
    const innerH = height - EDGE * 2;
    const coords = points.map((p, i) => ({
      key: p.key,
      x: points.length === 1 ? width / 2 : EDGE + (i / (points.length - 1)) * innerW,
      // A flat series sits in the middle rather than on the floor, which would read as zero.
      y: span === 0 ? height / 2 : EDGE + (1 - (p.value - min) / span) * innerH,
    }));
    const path = coords.map((c, i) => `${i === 0 ? 'M' : 'L'}${c.x.toFixed(1)} ${c.y.toFixed(1)}`).join(' ');
    return { coords, path, min, max, dots: points.length <= innerW / DOT_SPACING };
  }, [height, points, width]);

  const first = points[0];
  const last = points.at(-1);

  return (
    <View style={style} accessible accessibilityRole="image" accessibilityLabel={accessibilityLabel}>
      <View style={styles.plotRow}>
        <View style={[styles.plot, { height }]} onLayout={onLayout}>
          {geometry ? (
            <Svg width={width} height={height} aria-hidden focusable={false}>
              <Line
                x1={0}
                x2={width}
                y1={height - EDGE}
                y2={height - EDGE}
                stroke={theme.colors.chartGrid}
                strokeWidth={1}
              />
              <Path
                d={geometry.path}
                stroke={stroke}
                strokeWidth={2.5}
                strokeLinejoin="round"
                strokeLinecap="round"
                fill="none"
              />
              {geometry.coords.map((c, i) =>
                geometry.dots || i === geometry.coords.length - 1 ? (
                  <Circle
                    key={c.key}
                    cx={c.x}
                    cy={c.y}
                    r={i === geometry.coords.length - 1 ? DOT + 1.5 : DOT}
                    fill={i === geometry.coords.length - 1 ? stroke : theme.colors.surface}
                    stroke={stroke}
                    strokeWidth={2}
                  />
                ) : null,
              )}
            </Svg>
          ) : null}
        </View>
        {geometry ? (
          <View style={[styles.scale, { height }]}>
            <Txt variant="micro" tone="faint" numberOfLines={1}>
              {format(geometry.max)}
            </Txt>
            <Txt variant="micro" tone="faint" numberOfLines={1}>
              {format(geometry.min)}
            </Txt>
          </View>
        ) : null}
      </View>
      {first && last ? (
        <View style={styles.axis}>
          <Txt variant="micro" tone="faint" numberOfLines={1}>
            {first.label}
          </Txt>
          {points.length > 1 ? (
            <Txt variant="micro" tone="faint" numberOfLines={1}>
              {last.label}
            </Txt>
          ) : null}
        </View>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  plotRow: { flexDirection: 'row', gap: spacing.sm },
  plot: { flex: 1, minWidth: 0 },
  scale: { justifyContent: 'space-between', alignItems: 'flex-end' },
  axis: { flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing.xs },
});
