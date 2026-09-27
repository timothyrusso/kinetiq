import { StyleSheet } from 'react-native';
import { screenGutter, type Theme } from '@/features/core/theme';

/**
 * Row lists get no wrapper padding of their own: `ListRow` and `ExerciseRow` carry their own
 * `screenGutter` inset and a full-bleed hairline, so a second inset would make their dividers
 * stop short of the edge the rest of the app's dividers reach.
 */
export const createStyles = (_theme: Theme) =>
  StyleSheet.create({
    section: { paddingHorizontal: screenGutter },
    flex: { flex: 1 },
  });
