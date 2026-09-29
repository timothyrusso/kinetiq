import { StyleSheet } from 'react-native';
import { spacing, type Theme } from '@/features/core/theme';

export const createStyles = (theme: Theme) =>
  StyleSheet.create({
    row: { gap: spacing.xs, paddingTop: spacing.sm },
    divider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.colors.hairline },
    head: { flexDirection: 'row', alignItems: 'center' },
    line: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
    flex: { flex: 1 },
  });
