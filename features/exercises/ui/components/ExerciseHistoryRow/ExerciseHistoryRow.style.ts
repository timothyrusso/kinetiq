import { StyleSheet } from 'react-native';
import type { Theme } from '@/features/core/theme';

export const createStyles = (theme: Theme) =>
  StyleSheet.create({
    divider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.colors.hairline },
  });
