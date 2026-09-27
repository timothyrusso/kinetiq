import { StyleSheet } from 'react-native';
import { spacing, type Theme } from '@/features/core/theme';

export const createStyles = (theme: Theme) =>
  StyleSheet.create({
    card: {
      padding: spacing.lg,
      gap: spacing.md,
      overflow: 'hidden',
      backgroundColor: theme.colors[theme.surfaceSkin.surface],
      borderRadius: theme.surfaceSkin.radius,
    },
    pressed: { backgroundColor: theme.colors.surfacePressed },
    head: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
    titles: { flex: 1, minWidth: 0, gap: spacing.xs },
  });
