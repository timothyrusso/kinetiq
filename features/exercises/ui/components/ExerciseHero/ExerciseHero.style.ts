import { StyleSheet } from 'react-native';
import { screenGutter, type Theme } from '@/features/core/theme';

export const createStyles = (_theme: Theme) =>
  StyleSheet.create({
    image: { flex: 1 },
    noArt: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: screenGutter },
  });
