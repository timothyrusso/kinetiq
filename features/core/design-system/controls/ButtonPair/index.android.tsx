/**
 * Two Material 3 outlined buttons side by side, equal in width and in height. When one label
 * wraps, the other button grows to match and keeps its label centred.
 *
 * Compose here has no intrinsic-height modifier, so the row measures itself: each button
 * reports its height, and both get the tallest as their minimum. A button's own height never
 * shrinks below its content, so the reported heights only settle upwards. The measurement
 * restarts when a label changes (a language switch), so a shorter pair can shrink again.
 */

import { Host, OutlinedButton, Row, Text } from '@expo/ui/jetpack-compose';
import { defaultMinSize, fillMaxWidth, onSizeChanged, weight } from '@expo/ui/jetpack-compose/modifiers';
import { memo, useCallback, useState } from 'react';
import type { ButtonPairItem, ButtonPairProps } from '@/features/core/design-system/controls/ButtonPair/types';
import { haptics } from '@/features/core/haptics';
import { spacing, useAppTheme } from '@/features/core/theme';

export type { ButtonPairItem, ButtonPairProps } from '@/features/core/design-system/controls/ButtonPair/types';

const HOST_STYLE = { width: '100%' } as const;
const CENTRED = { textAlign: 'center' } as const;

export const ButtonPair = memo(function ButtonPair(props: ButtonPairProps) {
  return <MeasuredPair key={`${props.left.label}|${props.right.label}`} {...props} />;
});

function MeasuredPair({ left, right }: ButtonPairProps) {
  const theme = useAppTheme();
  const [minHeight, setMinHeight] = useState(0);
  const measure = useCallback(
    ({ height }: { height: number }) => setMinHeight(current => Math.max(current, Math.ceil(height))),
    [],
  );
  const half = (item: ButtonPairItem) => (
    <OutlinedButton
      onClick={() => {
        haptics.medium();
        item.onPress();
      }}
      enabled={!(item.disabled ?? false)}
      modifiers={[weight(1), defaultMinSize({ minHeight }), onSizeChanged(measure)]}
    >
      <Text style={CENTRED}>{item.label}</Text>
    </OutlinedButton>
  );
  return (
    <Host
      matchContents={{ vertical: true }}
      colorScheme={theme.mode}
      seedColor={theme.colors.accent}
      style={HOST_STYLE}
    >
      <Row horizontalArrangement={{ spacedBy: spacing.md }} modifiers={[fillMaxWidth()]}>
        {half(left)}
        {half(right)}
      </Row>
    </Host>
  );
}
