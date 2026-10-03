import { StyleSheet } from 'react-native';
import { radius, spacing, type Theme } from '@/features/core/theme';

export const createStyles = (theme: Theme) =>
  StyleSheet.create({
    row: { gap: spacing.xs, paddingTop: spacing.sm },
    divider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.colors.hairline },
    // NOTE: the tint bleeds past the column by the same amount it pads, so the steppers stay
    // aligned with the rows above and below it.
    highlighted: {
      backgroundColor: theme.colors.accentSoft,
      borderRadius: radius.md,
      marginHorizontal: -spacing.sm,
      paddingHorizontal: spacing.sm,
      paddingBottom: spacing.sm,
    },
    head: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
    line: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
    flex: { flex: 1 },
  });
