import { StyleSheet } from 'react-native';
import { spacing, type Theme } from '@/features/core/theme';

export const createStyles = (theme: Theme) =>
  StyleSheet.create({
    about: { gap: spacing.md },
    // NOTE: the photos are 3:2 and fill their frame; the placeholder shows only while one decodes.
    image: { width: '100%', aspectRatio: 3 / 2, borderRadius: spacing.md, backgroundColor: theme.colors.placeholder },
  });
