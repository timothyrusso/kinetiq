import { StyleSheet } from 'react-native';
import { spacing, type Theme, touchTarget } from '@/features/core/theme';

export const createStyles = (theme: Theme) =>
  StyleSheet.create({
    about: { gap: spacing.md },
    link: { gap: spacing.sm },
    title: { minHeight: touchTarget },
    pressed: { opacity: 0.6 },
    // NOTE: the photos are 3:2 and fill their frame, clipped to its corners; the placeholder shows
    // only while one decodes.
    image: {
      width: '100%',
      aspectRatio: 3 / 2,
      borderRadius: spacing.md,
      overflow: 'hidden',
      backgroundColor: theme.colors.placeholder,
    },
  });
