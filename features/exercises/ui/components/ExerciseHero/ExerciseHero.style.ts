import { StyleSheet } from 'react-native';
import { screenGutter, type Theme } from '@/features/core/theme';

export const createStyles = (theme: Theme) =>
  StyleSheet.create({
    // NOTE: The placeholder sits on the frame, not the slot, so the strip under the transparent
    // bar stays the page colour and the status bar keeps its contrast.
    frame: { width: '100%', aspectRatio: 3 / 2, backgroundColor: theme.colors.placeholder },
    noArt: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: screenGutter },
  });
