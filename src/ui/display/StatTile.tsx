/**
 * One number that matters: a big numeral, a small uppercase label, an optional unit and trend.
 *
 * For counts and durations that are the POINT of a screen (this week's minutes, a run's
 * distance). When the same number is only context, it belongs in a `MetaLine` instead; two
 * tiles fighting a paragraph for attention is how a dashboard stops reading at a glance.
 */
import { memo } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { useAppTheme } from '@/theme/theme';
import { spacing } from '@/theme/tokens';
import { Icon, ICON_SIZE } from '@/ui/icons';
import { MetricLabel, Txt } from '@/ui/Text';
import type { Trend } from './types';

export const StatTile = memo(function StatTile({
  value,
  label,
  unit,
  trend,
  emphasis = 'default',
  note,
  tabular = false,
  style,
}: {
  value: string;
  label: string;
  unit?: string;
  trend?: Trend;
  /** `compact` is for tiles three or four abreast, where the default numeral truncates. */
  emphasis?: 'hero' | 'default' | 'compact';
  /** One quiet line under the value that says what it is measured against ("2.5 per week"). */
  note?: string;
  /** Fixed-width digits, for a value that ticks (a clock) and must not reflow as it does. */
  tabular?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const theme = useAppTheme();
  const trendColor =
    trend?.direction === 'up'
      ? theme.colors.success
      : trend?.direction === 'down'
        ? theme.colors.danger
        : theme.colors.textMuted;
  return (
    <View
      style={[styles.tile, style]}
      accessible
      accessibilityLabel={[label, unit ? `${value} ${unit}` : value, trend?.delta, note]
        .filter(Boolean)
        .join(', ')}
    >
      <MetricLabel label={label} />
      <View style={styles.valueRow}>
        <Txt
          variant={NUMERAL[emphasis]}
          numberOfLines={1}
          style={tabular ? styles.tabular : undefined}
        >
          {value}
        </Txt>
        {unit ? (
          <Txt variant="label" tone="muted" numberOfLines={1}>
            {unit}
          </Txt>
        ) : null}
      </View>
      {trend ? (
        <View style={styles.trend}>
          {trend.direction === 'flat' ? null : (
            <Icon
              name={trend.direction === 'up' ? 'trendUp' : 'chevronDown'}
              size={ICON_SIZE.micro}
              color={trendColor}
            />
          )}
          <Txt variant="caption" color={trendColor}>
            {trend.delta}
          </Txt>
        </View>
      ) : null}
      {note ? (
        <Txt variant="micro" tone="faint" numberOfLines={1}>
          {note}
        </Txt>
      ) : null}
    </View>
  );
});

const NUMERAL = { hero: 'numeralLg', default: 'numeral', compact: 'numeralSm' } as const;

const styles = StyleSheet.create({
  tile: { flex: 1, minWidth: 0, gap: spacing.xs },
  valueRow: { flexDirection: 'row', alignItems: 'baseline', gap: spacing.xs },
  trend: { flexDirection: 'row', alignItems: 'center', gap: spacing.xxs },
  tabular: { fontVariant: ['tabular-nums'] },
});
