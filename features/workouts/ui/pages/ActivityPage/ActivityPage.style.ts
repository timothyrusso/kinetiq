import { StyleSheet } from 'react-native';
import { radius, screenGutter, spacing, type Theme } from '@/features/core/theme';

export const createStyles = (theme: Theme) =>
  StyleSheet.create({
    content: { paddingHorizontal: screenGutter, paddingTop: spacing.md },
    hero: { padding: spacing.lg, borderRadius: radius.xl, backgroundColor: theme.colors.surface },
    flex: { flex: 1 },
    empty: { paddingTop: spacing.xxxl },
  });
