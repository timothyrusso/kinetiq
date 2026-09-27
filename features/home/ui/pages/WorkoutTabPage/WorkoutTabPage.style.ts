import { StyleSheet } from 'react-native';
import { screenGutter, spacing, type Theme } from '@/features/core/theme';

export const createStyles = (_theme: Theme) =>
  StyleSheet.create({
    content: { flexGrow: 1 },
    section: { paddingHorizontal: screenGutter, paddingTop: spacing.xxl },
    order: { marginBottom: spacing.md },
  });
