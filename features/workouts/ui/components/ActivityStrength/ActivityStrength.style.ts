import { StyleSheet } from 'react-native';
import { spacing, type Theme } from '@/features/core/theme';

export const createStyles = (_theme: Theme) =>
  StyleSheet.create({
    // NOTE: every section is the same rhythm above its title, so a new one cannot drift.
    section: { paddingTop: spacing.xxxl },
    shrink: { flex: 1, minWidth: 0 },
  });
