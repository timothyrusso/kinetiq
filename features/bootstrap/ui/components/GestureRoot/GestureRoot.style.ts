import { StyleSheet } from 'react-native';
import type { Theme } from '@/features/core/theme';

export const createStyles = (theme: Theme) =>
  StyleSheet.create({ root: { flex: 1, backgroundColor: theme.colors.background } });
