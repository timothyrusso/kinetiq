/**
 * A handful of weekly columns, each with its value on top and its week underneath.
 *
 * Views, not a canvas, and the same shape as the volume bars on a workout card: rounded
 * columns sharing the row with `flex: 1`. That is what keeps it inside its card: a chart that
 * needs a measured pixel width can be handed the wrong one, and the old SVG bar chart ran past
 * the card's right edge and took the last label with it. Flex has no width to get wrong.
 *
 * Every column carries its own number, so the chart reads without a scrubber or an axis: the
 * question it answers ("how much did I train each week") is answered by reading it.
 */
import { memo } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { radius, spacing } from '@/theme/tokens';
import type { Theme } from '@/theme/theme';
import { Txt } from '../Text';

export type WeeklyBar = {
  /** Stable per week (the week's start), so React keeps the column across refetches. */
  key: string;
  /** Under the column: "17 Aug", "Now". */
  label: string;
  value: number;
  /** Above the column, already formatted by the caller. */
  valueLabel: string;
  /** The current week, drawn at full strength; the rest are context. */
  current: boolean;
};

const PLOT_HEIGHT = 96;
/** A zero week still shows a stub, so an empty week reads as "nothing" rather than "missing". */
const MIN_BAR = spacing.xs;
const PAST_OPACITY = 0.38;

export const WeeklyBars = memo(function WeeklyBars({
  bars,
  theme,
  color,
  accessibilityLabel,
  style,
}: {
  bars: WeeklyBar[];
  theme: Theme;
  color?: string;
  accessibilityLabel: string;
  style?: StyleProp<ViewStyle>;
}) {
  const fill = color ?? theme.colors.accent;
  const top = Math.max(1, ...bars.map((b) => b.value));

  return (
    <View
      style={[styles.row, style]}
      accessible
      accessibilityRole="image"
      accessibilityLabel={accessibilityLabel}
    >
      {bars.map((bar) => (
        <View key={bar.key} style={styles.column}>
          <Txt
            variant="caption"
            weight={bar.current ? '600' : undefined}
            tone={bar.current ? 'default' : 'muted'}
            numberOfLines={1}
          >
            {bar.valueLabel}
          </Txt>
          <View style={styles.plot}>
            <View
              style={[
                styles.bar,
                {
                  height: Math.max(MIN_BAR, Math.round((bar.value / top) * PLOT_HEIGHT)),
                  backgroundColor: fill,
                  opacity: bar.current ? 1 : PAST_OPACITY,
                },
              ]}
            />
          </View>
          <Txt
            variant="micro"
            tone={bar.current ? 'default' : 'faint'}
            numberOfLines={1}
          >
            {bar.label}
          </Txt>
        </View>
      ))}
    </View>
  );
});

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm },
  column: { flex: 1, minWidth: 0, alignItems: 'center', gap: spacing.xs },
  plot: { height: PLOT_HEIGHT, alignSelf: 'stretch', justifyContent: 'flex-end' },
  bar: { alignSelf: 'stretch', borderRadius: radius.xs },
});
