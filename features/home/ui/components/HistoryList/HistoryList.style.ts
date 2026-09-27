import { StyleSheet } from 'react-native';
import { screenGutter, spacing, type Theme } from '@/features/core/theme';

export const createStyles = (theme: Theme) =>
  StyleSheet.create({
    list: { backgroundColor: theme.colors.background },
    load: { paddingHorizontal: screenGutter, paddingTop: spacing.md },
    firstWeek: { paddingHorizontal: screenGutter, paddingTop: spacing.xxl },
    week: { paddingHorizontal: screenGutter, paddingTop: spacing.xl },
    skeleton: { paddingTop: spacing.lg },
  });
