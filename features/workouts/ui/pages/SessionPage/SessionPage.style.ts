import { StyleSheet } from 'react-native';
import { screenGutter, spacing, type Theme, z } from '@/features/core/theme';

export const createStyles = (theme: Theme) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: theme.colors.background },
    // NOTE: no border: `OverlaySurface` draws the hairline, and a second one reads as a fuzzier line.
    bar: { paddingHorizontal: screenGutter, paddingBottom: spacing.md, zIndex: z.sticky },
    barTitles: { flex: 1, minWidth: 0, gap: spacing.xxs },
    barGap: { height: spacing.sm },
    content: { flexGrow: 1, paddingTop: spacing.lg },
    section: { paddingHorizontal: screenGutter, paddingTop: spacing.xxl },
    dangerCard: { borderColor: theme.colors.danger },
    warningCard: { borderColor: theme.colors.warning },
    flex: { flex: 1 },
    errorDetail: { marginTop: spacing.xxs },
    blocks: { gap: spacing.md },
    empty: { paddingTop: spacing.xxxl },
    // NOTE: no `zIndex`: the rest dock renders after this at `z.sticky` and must stay on top.
    footer: {
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: 0,
      paddingHorizontal: screenGutter,
      paddingTop: spacing.md,
    },
  });
