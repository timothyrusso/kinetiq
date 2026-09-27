import { useMemo } from 'react';

/** The fill's width for `ratio`, clamped to the track and rebuilt only when the percentage moves. */
export function useSessionProgressBarLogic(ratio: number) {
  const percent = Math.round(Math.min(1, Math.max(0, ratio)) * 100);
  const fillWidth = useMemo(() => ({ width: `${percent}%` as const }), [percent]);
  return { derived: { fillWidth } };
}
