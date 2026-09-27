import { StyleSheet } from 'react-native';
import { screenGutter, spacing, type Theme } from '@/features/core/theme';

export const createStyles = (_theme: Theme) =>
  StyleSheet.create({
    flex: { flex: 1 },
    content: { paddingTop: spacing.lg, gap: spacing.xxl },
    gutter: { paddingHorizontal: screenGutter },
    stats: { flexDirection: 'row', gap: spacing.lg, paddingHorizontal: screenGutter },
  });
