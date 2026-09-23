/**
 * What a chart shows when it has nothing to draw.
 *
 * One component rather than a copy inside each chart. Every chart in this app had its own,
 * which meant four slightly different type sizes and two different vertical alignments for the
 * same idea, and a chart with no data is not a rare state in a fitness app: it is what the
 * first week looks like.
 *
 * Sized to the chart it replaces so the surrounding card does not change height when data
 * arrives. A layout that jumps when the first workout is logged reads as a bug.
 */
import { memo } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';

import type { Theme } from '@/theme/theme';
import { radius } from '@/theme/tokens';
import { Txt } from '../Text';

export const EmptyChart = memo(function EmptyChart({
  height,
  label,
  theme,
  style,
}: {
  height: number;
  label: string;
  theme: Theme;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View
      style={[
        {
          height,
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: radius.sm,
          backgroundColor: theme.colors.placeholder,
        },
        style,
      ]}
      accessibilityRole="image"
      accessibilityLabel={label}
    >
      <Txt variant="caption" tone="faint" align="center">
        {label}
      </Txt>
    </View>
  );
});
