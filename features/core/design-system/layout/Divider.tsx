import { memo } from 'react';
import { StyleSheet, View } from 'react-native';
import { useAppTheme } from '@/features/core/theme';

/**
 * A hairline rule. Hairlines are a classic mobile bug: a hard 0.5 is correct on a 2x screen and
 * invisible on a 1x one. `StyleSheet.hairlineWidth` is the platform's own answer,
 * and it is a device constant rather than theme state: hence a module-level
 * read rather than a hook.
 */
export const Divider = memo(function Divider({ inset = 0, color }: { inset?: number; color?: string }) {
  const theme = useAppTheme();
  return (
    <View
      style={{
        height: StyleSheet.hairlineWidth,
        backgroundColor: color ?? theme.colors.hairline,
        marginHorizontal: inset,
      }}
    />
  );
});
