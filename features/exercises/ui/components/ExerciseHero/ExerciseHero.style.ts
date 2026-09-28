import { StyleSheet } from 'react-native';
import { illustrationBackdrop } from '@/features/core/design-system';
import { screenGutter, type Theme } from '@/features/core/theme';

export const createStyles = (theme: Theme) =>
  StyleSheet.create({
    // NOTE: The backdrop sits on the image, not the slot, so the strip under the transparent bar
    // stays the page colour and the status bar keeps its contrast.
    image: { flex: 1, backgroundColor: illustrationBackdrop(theme) },
    noArt: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: screenGutter },
  });
