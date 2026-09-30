import { useCallback, useMemo } from 'react';
import type { LayoutChangeEvent } from 'react-native';
import type { MetaItem } from '@/features/core/design-system';

/** One press of the dock's adjusters. */
const ADJUST_STEP_SECONDS = 15;
/** The longest rest the adjusters reach. */
const MAX_REST_SECONDS = 600;

/** The line under the timer when the rest will end without an alert: what is off, and the way to fix it. */
export interface RestAlertsNotice {
  readonly meta: readonly MetaItem[];
  readonly action: string;
  readonly hint: string;
}

export interface RestDockInput {
  readonly remainingSeconds: number;
  readonly totalSeconds: number;
  /** How far above the window's bottom edge the dock stands: the top of the chrome beneath it. */
  readonly bottom: number;
  readonly onAdjust: (seconds: number) => void;
  /** The dock's own height, so the scroll view behind it can leave room for it. */
  readonly onHeight?: (height: number) => void;
  /** Set when the rest's alert cannot reach the phone; `null` draws no line. */
  readonly alertsOff?: RestAlertsNotice | null;
}

/** The dock's place above the screen's footer, its progress, and the adjusters' next values. */
export function useRestDockLogic({ remainingSeconds, totalSeconds, bottom, onAdjust, onHeight }: RestDockInput) {
  const progress = totalSeconds > 0 ? Math.min(1, Math.max(0, remainingSeconds / totalSeconds)) : 0;
  const percent = Math.round(progress * 100);
  const fillWidth = useMemo(() => ({ width: `${percent}%` as const }), [percent]);
  const position = useMemo(() => ({ bottom }), [bottom]);
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
