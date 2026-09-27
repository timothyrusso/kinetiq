import { useCallback, useMemo } from 'react';
import { type AccentChoice, type Theme, touchTarget } from '@/features/core/theme';

/** A swatch's press, its ripple, and the ring and fill colours for its state. */
export function useAccentSwatchLogic(
  option: AccentChoice,
  color: string,
  selected: boolean,
  theme: Theme,
  onPick: (option: AccentChoice) => void,
) {
  const press = useCallback(() => onPick(option), [onPick, option]);
  const derived = useMemo(
    () => ({
      ripple: { color: theme.colors.surfacePressed, borderless: true, radius: touchTarget / 2 },
      ring: { borderColor: selected ? theme.colors.text : 'transparent' },
      fill: { backgroundColor: color },
    }),
    [color, selected, theme],
  );
  return { derived, effects: { press } };
}
