import { memo, type ReactNode } from 'react';
import { type StyleProp, View, type ViewStyle } from 'react-native';
import {
  type Align,
  crossAxis,
  type Justify,
  mainAxis,
  type SpacingStep,
} from '@/features/core/design-system/layout/flex';
import { spacing } from '@/features/core/theme';

/** A column: the arrangement stated once, gaps and paddings from the spacing scale. */
export type StackProps = {
  gap?: SpacingStep;
  align?: Align;
  justify?: Justify;
  padding?: SpacingStep;
  px?: SpacingStep;
  py?: SpacingStep;
  flex?: number;
  fill?: boolean;
  style?: StyleProp<ViewStyle>;
  children?: ReactNode;
};

export const Stack = memo(function Stack({
  gap,
  align,
  justify,
  padding,
  px,
  py,
  flex,
  fill,
  style,
  children,
}: StackProps) {
  return (
    <View
      style={[
        { flexDirection: 'column' },
        fill && { flex: 1 },
        flex === undefined ? null : { flex },
        gap === undefined ? null : { gap: spacing[gap] },
        align === undefined ? null : { alignItems: crossAxis(align) },
        justify === undefined ? null : { justifyContent: mainAxis(justify) },
        padding === undefined ? null : { padding: spacing[padding] },
        px === undefined ? null : { paddingHorizontal: spacing[px] },
        py === undefined ? null : { paddingVertical: spacing[py] },
        style,
      ]}
    >
      {children}
    </View>
  );
});
