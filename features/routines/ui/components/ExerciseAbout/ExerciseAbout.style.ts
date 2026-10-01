import { StyleSheet } from 'react-native';
import { palette, spacing, type Theme } from '@/features/core/theme';

export const createStyles = (_theme: Theme) =>
  StyleSheet.create({
    about: { gap: spacing.md },
    // NOTE: photos sit on white in both themes: they are shot on white, and their margins would
    // read as a hole in the dark canvas.
    art: { borderRadius: spacing.md, overflow: 'hidden', padding: spacing.sm, backgroundColor: palette.white },
    image: { width: '100%', aspectRatio: 4 / 3 },
  });
