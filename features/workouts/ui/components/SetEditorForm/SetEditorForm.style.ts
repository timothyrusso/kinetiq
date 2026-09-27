import { StyleSheet } from 'react-native';
import { spacing, type Theme } from '@/features/core/theme';

export const createStyles = (_theme: Theme) =>
  StyleSheet.create({
    note: { marginTop: spacing.sm },
  });
