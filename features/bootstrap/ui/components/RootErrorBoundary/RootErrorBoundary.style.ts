import { StyleSheet } from 'react-native';
import { spacing, type Theme } from '@/features/core/theme';

export const createStyles = (theme: Theme) =>
  StyleSheet.create({
    root: {
      flex: 1,
      padding: spacing.xl,
      justifyContent: 'center',
      gap: spacing.md,
      backgroundColor: theme.colors.background,
    },
    badge: { fontSize: 11, fontWeight: '700', letterSpacing: 1.2, color: theme.colors.danger },
    title: { fontSize: 24, lineHeight: 30, fontWeight: '700', letterSpacing: -0.4, color: theme.colors.text },
    body: { fontSize: 15, lineHeight: 22, color: theme.colors.textMuted },
    messageBox: {
      borderRadius: 10,
      borderWidth: StyleSheet.hairlineWidth,
      padding: spacing.md,
      backgroundColor: theme.colors.surface,
      borderColor: theme.colors.border,
    },
    message: { fontSize: 13.5, lineHeight: 20, fontFamily: 'monospace', color: theme.colors.text },
    actions: { flexDirection: 'row', gap: spacing.lg, marginTop: spacing.sm },
    retry: { fontSize: 15, fontWeight: '600', paddingVertical: spacing.sm, color: theme.colors.accent },
    settings: { fontSize: 15, fontWeight: '600', paddingVertical: spacing.sm, color: theme.colors.textMuted },
  });
