import { StyleSheet } from 'react-native';
import { spacing, type Theme } from '@/features/core/theme';

export const createStyles = (_theme: Theme) =>
  StyleSheet.create({
    shrink: { flex: 1, minWidth: 0 },
    pressed: { opacity: 0.6 },
    headRow: { paddingVertical: spacing.xs },
    dataRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.md },
    // NOTE: a planned set not done is part of the record, so it is dimmed rather than hidden.
    dimmed: { opacity: 0.5 },
    narrow: { width: 30 },
    wide: { width: 54 },
    cell: { flex: 1 },
  });
