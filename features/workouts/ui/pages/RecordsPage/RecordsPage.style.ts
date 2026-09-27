import { StyleSheet } from 'react-native';
import { spacing, type Theme } from '@/features/core/theme';

export const createStyles = (theme: Theme) =>
  StyleSheet.create({
    list: { gap: spacing.sm },
    record: {
      borderWidth: StyleSheet.hairlineWidth,
      padding: spacing.lg,
      backgroundColor: theme.colors.accentSoft,
      borderColor: theme.colors.border,
      borderRadius: theme.surfaceSkin.radius,
    },
    flex: { flex: 1, minWidth: 0 },
  });
