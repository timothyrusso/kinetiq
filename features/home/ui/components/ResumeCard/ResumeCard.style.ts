import { StyleSheet } from 'react-native';
import { screenGutter, spacing, type Theme } from '@/features/core/theme';

export const createStyles = (theme: Theme) =>
  StyleSheet.create({
    section: { paddingHorizontal: screenGutter, paddingTop: spacing.xxl },
    body: { flex: 1, minWidth: 0 },
    title: { marginTop: spacing.xs },
    meta: { marginTop: spacing.xs },
    dot: { width: 8, height: 8, borderRadius: 4 },
    dotLive: { backgroundColor: theme.colors.success },
    dotPaused: { backgroundColor: theme.colors.warning },
  });
