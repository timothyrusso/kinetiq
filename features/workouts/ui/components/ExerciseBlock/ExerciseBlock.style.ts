import { StyleSheet } from 'react-native';
import { radius, spacing, type Theme } from '@/features/core/theme';

export const createStyles = (theme: Theme) =>
  StyleSheet.create({
    block: {
      overflow: 'hidden',
      backgroundColor: theme.colors.surface,
      borderRadius: theme.surfaceSkin.radius,
      borderColor: theme.colors.border,
      borderWidth: StyleSheet.hairlineWidth,
    },
    head: { paddingHorizontal: spacing.lg, paddingTop: spacing.lg },
    headPressed: { opacity: 0.85 },
    titles: { flex: 1, minWidth: 0 },
    dot: { width: 7, height: 7, borderRadius: radius.pill, backgroundColor: theme.colors.accent },
    previous: { marginTop: spacing.xs },
    count: { fontVariant: ['tabular-nums'] },
    cue: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm },
    sets: { paddingHorizontal: spacing.lg, paddingTop: spacing.md },
    foot: { paddingHorizontal: spacing.lg, paddingBottom: spacing.lg, paddingTop: spacing.sm },
    spacer: { flex: 1 },
    textAction: { paddingHorizontal: spacing.sm, paddingVertical: spacing.sm },
    textActionPressed: { opacity: 0.55 },
  });
