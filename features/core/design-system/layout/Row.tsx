import { memo } from 'react';
import { View } from 'react-native';
import { crossAxis, mainAxis } from '@/features/core/design-system/layout/flex';
import type { StackProps } from '@/features/core/design-system/layout/Stack';
import { spacing } from '@/features/core/theme';

/** A row, centred on the cross axis unless told otherwise. */
export const Row = memo(function Row({
  gap,
  align = 'center',
  justify,
  wrap,
  flex,
  fill,
  style,
  children,
}: Omit<StackProps, 'padding' | 'px' | 'py'> & { wrap?: boolean }) {
  return (
    <View
      style={[
        { flexDirection: 'row' },
        fill && { flex: 1 },
        flex === undefined ? null : { flex },
        gap === undefined ? null : { gap: spacing[gap] },
        align === undefined ? null : { alignItems: crossAxis(align) },
        justify === undefined ? null : { justifyContent: mainAxis(justify) },
        wrap ? { flexWrap: 'wrap' } : null,
        style,
      ]}
    >
      {children}
    </View>
  );
});
