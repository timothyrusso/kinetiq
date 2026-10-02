import { StyleSheet } from 'react-native';
import { screenGutter, type Theme } from '@/features/core/theme';

export const createStyles = (theme: Theme) =>
  StyleSheet.create({
    frame: { width: '100%', aspectRatio: 3 / 2, backgroundColor: theme.colors.placeholder },
    // NOTE: close to a 3:2 photo across a phone, so the content below does not jump.
    noArt: { height: 270, alignItems: 'center', justifyContent: 'center', paddingHorizontal: screenGutter },
  });
