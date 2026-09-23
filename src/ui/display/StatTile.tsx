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
  style,
}: {
  value: string;
  label: string;
  unit?: string;
  trend?: Trend;
  emphasis?: 'hero' | 'default';
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
      accessibilityLabel={[label, unit ? `${value} ${unit}` : value, trend?.delta]
        .filter(Boolean)
        .join(', ')}
    >
      <MetricLabel label={label} />
      <View style={styles.valueRow}>
        <Txt variant={emphasis === 'hero' ? 'numeralLg' : 'numeral'} numberOfLines={1}>
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
    </View>
  );
});

const styles = StyleSheet.create({
  tile: { flex: 1, minWidth: 0, gap: spacing.xs },
  valueRow: { flexDirection: 'row', alignItems: 'baseline', gap: spacing.xs },
  trend: { flexDirection: 'row', alignItems: 'center', gap: spacing.xxs },
});
