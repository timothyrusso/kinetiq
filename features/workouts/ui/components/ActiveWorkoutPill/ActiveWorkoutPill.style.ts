import { StyleSheet } from 'react-native';
import { radius, spacing, type Theme } from '@/features/core/theme';

export const createStyles = (theme: Theme) =>
  StyleSheet.create({
    pill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.sm + 2,
      borderRadius: radius.pill,
      backgroundColor: theme.colors.surfaceRaised,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.colors.border,
      ...theme.shadows.raised,
    },
    pressed: { opacity: 0.88 },
    dot: { width: 8, height: 8, borderRadius: radius.pill, backgroundColor: theme.colors.tertiary },
  });
