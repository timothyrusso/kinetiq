import { memo } from 'react';
import { View } from 'react-native';

/**
 * Fixed pixel gap. Prefer `Stack gap`; this exists for the case where a gap has
 * to be a specific number because something else measures it, e.g. the inset
 * that matches a chart's axis width.
 */
export const Gap = memo(function Gap({ size }: { size: number }) {
  return <View style={{ width: size, height: size }} />;
});
