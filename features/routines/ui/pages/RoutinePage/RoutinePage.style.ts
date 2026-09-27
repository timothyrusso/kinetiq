import { StyleSheet } from 'react-native';
import { screenGutter, spacing, type Theme } from '@/features/core/theme';

export const createStyles = (_theme: Theme) =>
  StyleSheet.create({
    content: { paddingTop: spacing.xl, gap: spacing.xxl },
    gutter: { paddingHorizontal: screenGutter },
    stats: { flexDirection: 'row', gap: spacing.lg },
    flex: { flex: 1 },
    loading: { flex: 1, paddingHorizontal: screenGutter, paddingTop: spacing.md },
    centered: { flex: 1, justifyContent: 'center', paddingHorizontal: screenGutter },
  });
