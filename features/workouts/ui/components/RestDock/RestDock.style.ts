import { StyleSheet } from 'react-native';
import { radius, screenGutter, spacing, type Theme, z } from '@/features/core/theme';

export const createStyles = (theme: Theme) =>
  StyleSheet.create({
    dock: { position: 'absolute', left: screenGutter, right: screenGutter, zIndex: z.sticky },
    card: {
      borderWidth: StyleSheet.hairlineWidth,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
      backgroundColor: theme.colors.surface,
      borderColor: theme.colors.borderStrong,
      borderRadius: theme.surfaceSkin.radius,
      ...theme.shadows.raised,
    },
    body: { flex: 1, minWidth: 0 },
    time: { fontVariant: ['tabular-nums'] },
    track: {
      height: 4,
      borderRadius: radius.pill,
      marginTop: spacing.sm,
      overflow: 'hidden',
      backgroundColor: theme.colors.placeholder,
    },
    fill: { height: '100%', backgroundColor: theme.colors.accent, borderRadius: radius.pill },
    adjust: { flexDirection: 'row', gap: spacing.xs },
  });
