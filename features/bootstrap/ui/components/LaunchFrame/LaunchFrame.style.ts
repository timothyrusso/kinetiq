import { StyleSheet } from 'react-native';
import { spacing, type Theme } from '@/features/core/theme';

/**
 * The launch screens' styles. Plain system text in the launch palette, not `Txt` and not the
 * theme hook: the thing that failed might be the font loader or the settings store, and a screen
 * about a failure must not depend on the system that broke.
 */
export const createStyles = (theme: Theme) =>
  StyleSheet.create({
    frame: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      padding: spacing.xxl,
      backgroundColor: theme.brandBackground,
    },
    mark: { alignItems: 'center', gap: spacing.sm, marginBottom: spacing.xxxl },
    dot: { width: 14, height: 14, borderRadius: 7, backgroundColor: theme.colors.accent },
    text: { fontSize: 15, lineHeight: 22, letterSpacing: 0.1, textAlign: 'left', color: theme.colors.text },
    muted: { color: theme.colors.textMuted },
    title: { fontSize: 19, lineHeight: 26, fontWeight: '700', letterSpacing: -0.2 },
    brand: { fontSize: 15, lineHeight: 20, fontWeight: '700', letterSpacing: 4.2 },
    mono: { fontFamily: 'monospace', fontSize: 12, lineHeight: 18 },
  });
