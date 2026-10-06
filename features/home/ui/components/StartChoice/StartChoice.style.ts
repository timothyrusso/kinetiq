import { StyleSheet } from 'react-native';
import { screenGutter, spacing, type Theme } from '@/features/core/theme';

export const createStyles = (_theme: Theme) =>
  StyleSheet.create({ row: { paddingHorizontal: screenGutter, paddingTop: spacing.xxl } });
