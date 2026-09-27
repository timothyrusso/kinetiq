import { StyleSheet } from 'react-native';
import { spacing, type Theme } from '@/features/core/theme';

export const createStyles = (_theme: Theme) =>
  StyleSheet.create({
    panel: { width: '100%', maxWidth: 380, gap: spacing.sm, alignItems: 'flex-start' },
    actions: { marginTop: spacing.xs, flexWrap: 'wrap' },
  });
