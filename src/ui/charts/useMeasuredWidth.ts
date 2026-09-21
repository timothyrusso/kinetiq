/**
 * Measures its own width so a chart can fill a card without the card doing the arithmetic.
 *
 * State rather than a ref, because the chart's geometry is computed from the width and the
 * render has to wait for the measurement.
 *
 * The width is rounded on purpose. A sub-pixel layout difference would otherwise produce a new
 * width on every layout pass, and a chart that recomputes its geometry from a changing width is
 * the most common way one ends up re-rendering forever.
 *
 * It lived in `Sparkline.tsx` until that component was deleted, and four screens imported the
 * hook from a chart none of them rendered.
 */
import { useState } from 'react';
import type { LayoutChangeEvent } from 'react-native';

export function useMeasuredWidth(): readonly [number, (e: LayoutChangeEvent) => void] {
  const [width, setWidth] = useState(0);
  const onLayout = (e: LayoutChangeEvent) => {
    const next = Math.round(e.nativeEvent.layout.width);
    setWidth((prev) => (prev === next ? prev : next));
  };
  return [width, onLayout] as const;
}
