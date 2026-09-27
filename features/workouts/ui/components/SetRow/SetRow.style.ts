import { StyleSheet } from 'react-native';
import { radius, spacing, type Theme, touchTarget } from '@/features/core/theme';

export const createStyles = (theme: Theme) =>
  StyleSheet.create({
    row: { paddingVertical: spacing.xs },
    number: {
      width: 26,
      height: 26,
      borderRadius: radius.pill,
      borderWidth: StyleSheet.hairlineWidth,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.colors.canvas,
      borderColor: theme.colors.border,
    },
    numberDone: { backgroundColor: theme.colors.accent, borderColor: 'transparent' },
    numeral: { fontVariant: ['tabular-nums'] },
    value: {
      flex: 1,
      minWidth: 0,
      borderRadius: radius.md,
      borderWidth: StyleSheet.hairlineWidth,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      minHeight: touchTarget,
      justifyContent: 'center',
      backgroundColor: theme.colors.canvas,
      borderColor: theme.colors.border,
    },
    valuePressed: { backgroundColor: theme.colors.surfacePressed },
    valueTarget: { borderColor: theme.colors.accent },
  });
