import { useCallback, useMemo } from 'react';
import type { LayoutChangeEvent } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { spacing } from '@/features/core/theme';

/** One press of the dock's adjusters. */
const ADJUST_STEP_SECONDS = 15;
/** The longest rest the adjusters reach. */
const MAX_REST_SECONDS = 600;

export interface RestDockInput {
  readonly remainingSeconds: number;
  readonly totalSeconds: number;
  readonly onAdjust: (seconds: number) => void;
  /** The dock's own height, so the scroll view behind it can leave room for it. */
  readonly onHeight?: (height: number) => void;
}

/** The dock's place above the home indicator, its progress, and the adjusters' next values. */
export function useRestDockLogic({ remainingSeconds, totalSeconds, onAdjust, onHeight }: RestDockInput) {
  const insets = useSafeAreaInsets();
  const progress = totalSeconds > 0 ? Math.min(1, Math.max(0, remainingSeconds / totalSeconds)) : 0;
  const percent = Math.round(progress * 100);
  const fillWidth = useMemo(() => ({ width: `${percent}%` as const }), [percent]);
  const position = useMemo(() => ({ bottom: insets.bottom + spacing.md }), [insets.bottom]);
  const less = useCallback(
    () => onAdjust(Math.max(0, remainingSeconds - ADJUST_STEP_SECONDS)),
    [onAdjust, remainingSeconds],
  );
  const more = useCallback(
    () => onAdjust(Math.min(MAX_REST_SECONDS, remainingSeconds + ADJUST_STEP_SECONDS)),
    [onAdjust, remainingSeconds],
  );
  const layout = useCallback(
    (event: LayoutChangeEvent) => onHeight?.(Math.round(event.nativeEvent.layout.height)),
    [onHeight],
  );
  return { derived: { fillWidth, position }, effects: { less, more, layout } };
}
