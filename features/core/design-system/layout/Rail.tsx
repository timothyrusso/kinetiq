import { memo, type ReactNode } from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { screenGutter, spacing } from '@/features/core/theme';

/**
 * A horizontally scrolling row that bleeds to the screen edge.
 *
 * For a filter rail: every chip stays reachable, and a long list costs one row of height
 * instead of wrapping into four. The rail sits inside a gutter-padded body, so it cancels
 * that gutter with a negative margin and puts it back as content padding: the first chip
 * lines up with the text above it, and chips scroll under the edge rather than clipping at
 * an inset border. `screenGutter` both times, so it cannot drift from the body it sits in.
 */
export const Rail = memo(function Rail({ gap = 'sm', children }: { gap?: keyof typeof spacing; children: ReactNode }) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      style={railStyles.bleed}
      contentContainerStyle={[railStyles.content, { gap: spacing[gap] }]}
    >
      {children}
    </ScrollView>
  );
});

const railStyles = StyleSheet.create({
  bleed: { marginHorizontal: -screenGutter },
  content: { paddingHorizontal: screenGutter, alignItems: 'center' },
});
