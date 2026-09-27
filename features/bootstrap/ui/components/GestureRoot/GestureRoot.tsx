import type { ReactNode } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { createStyles } from '@/features/bootstrap/ui/components/GestureRoot/GestureRoot.style';
import { useStyles } from '@/features/core/design-system';

/**
 * The gesture root, exactly once, above everything: sheets, the tab bar and every chart's
 * scrubbing handler dead-end without it, and on Android the failure is silent. It paints the
 * canvas, so overscroll and the rounded screen corners reveal the theme's background, never white.
 */
export function GestureRoot({ children }: { children: ReactNode }) {
  const styles = useStyles(createStyles);
  return <GestureHandlerRootView style={styles.root}>{children}</GestureHandlerRootView>;
}
