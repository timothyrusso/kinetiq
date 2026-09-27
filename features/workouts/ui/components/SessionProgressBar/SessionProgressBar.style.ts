import { StyleSheet } from 'react-native';
import { radius, type Theme } from '@/features/core/theme';
import { withAlpha } from '@/features/core/utils';

export const createStyles = (theme: Theme) =>
  StyleSheet.create({
    track: {
      height: 3,
      borderRadius: radius.pill,
      overflow: 'hidden',
      backgroundColor: withAlpha(theme.colors.text, 0.1),
    },
    fill: { height: '100%', backgroundColor: theme.colors.accent, borderRadius: radius.pill },
  });
