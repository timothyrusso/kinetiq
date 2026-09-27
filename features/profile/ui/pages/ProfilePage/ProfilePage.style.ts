import { StyleSheet } from 'react-native';
import { screenGutter, spacing, type Theme } from '@/features/core/theme';

export const createStyles = (_theme: Theme) =>
  StyleSheet.create({
    identity: { paddingHorizontal: screenGutter, paddingTop: spacing.md, paddingBottom: spacing.xl },
    identityPressed: { opacity: 0.6 },
    fill: { flex: 1, minWidth: 0 },
    content: { flexGrow: 1 },
    body: { paddingHorizontal: screenGutter, gap: spacing.md },
    // NOTE: sections are a step further apart than blocks inside one.
    section: { marginTop: spacing.lg, marginBottom: 0 },
  });
