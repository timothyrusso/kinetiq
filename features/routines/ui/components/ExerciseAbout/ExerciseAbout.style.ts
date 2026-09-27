import { StyleSheet } from 'react-native';
import { palette, spacing, type Theme } from '@/features/core/theme';

export const createStyles = (_theme: Theme) =>
  StyleSheet.create({
    about: { gap: spacing.md },
    // NOTE: technical drawings sit on white in both themes: most wger art is black line work on a
    // transparent background, which vanishes on the dark canvas.
    art: { borderRadius: spacing.md, overflow: 'hidden', padding: spacing.sm, backgroundColor: palette.white },
    image: { width: '100%', aspectRatio: 4 / 3 },
  });
