import { StyleSheet } from 'react-native';
import { spacing, type Theme } from '@/features/core/theme';

export const createStyles = (_theme: Theme) =>
  StyleSheet.create({
    panel: { width: '100%', maxWidth: 380, gap: spacing.sm, alignItems: 'flex-start' },
    actions: { marginTop: spacing.xs, flexWrap: 'wrap' },
    messageBox: {
      alignSelf: 'stretch',
      borderRadius: 10,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: '#212B3F',
      backgroundColor: '#0B0F18',
      padding: spacing.sm,
    },
  });
