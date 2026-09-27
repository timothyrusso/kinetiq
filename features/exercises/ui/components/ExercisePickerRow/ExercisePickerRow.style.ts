import { StyleSheet } from 'react-native';
import type { Theme } from '@/features/core/theme';

export const createStyles = (theme: Theme) =>
  StyleSheet.create({
    row: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.colors.hairline },
    dimmed: { opacity: 0.45 },
  });
