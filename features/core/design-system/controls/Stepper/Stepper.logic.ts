import { useCallback, useEffect, useRef } from 'react';
import { type StepperProps, stepClamp } from '@/features/core/design-system/controls/Stepper/types';
import { haptics } from '@/features/core/haptics';

/** How long a press is held before it starts repeating: longer than any tap. */
export const REPEAT_DELAY_MS = 400;
/** The pace of the repeat once it has started. */
export const REPEAT_INTERVAL_MS = 110;

type Bounds = Required<Pick<StepperProps, 'min' | 'max' | 'step'>>;

/**
 * The Android stepper's press handling: one step on press, and hold-to-repeat only once the
 * press has outlasted a tap.
 *
 * The repeat waits `REPEAT_DELAY_MS` before its first tick because React Native's `Pressable`
 * holds `onPressOut` until at least 130 ms after `onPressIn`, however short the touch: a repeat
 * that ticked sooner than that added a second step to every tap.
 *
 * The tick reads the latest value from a ref, not from the closure: the classic stepper bug is a
 * hold that keeps adding to whatever number was under the finger when it started.
 *
 * `take` hands over whatever is typed in the field, unwritten, so a press made mid-typing steps
 * from the typed number in one write: two writes in flight can land out of order.
 */
export function useStepperPress(
  value: number,
  onChange: (next: number) => void,
  { min, max, step }: Bounds,
  take: () => number | null,
) {
  const delay = useRef<ReturnType<typeof setTimeout> | null>(null);
  const repeat = useRef<ReturnType<typeof setInterval> | null>(null);
  const valueRef = useRef(value);
  valueRef.current = value;

  const commit = useCallback(
    (delta: number, from = valueRef.current) => {
      const next = stepClamp(from + delta, { min, max, step });
      if (next === valueRef.current) return;
      valueRef.current = next;
      haptics.selection();
      onChange(next);
    },
    [max, min, onChange, step],
  );
  const release = useCallback(() => {
    if (delay.current !== null) clearTimeout(delay.current);
    if (repeat.current !== null) clearInterval(repeat.current);
    delay.current = null;
    repeat.current = null;
  }, []);
  const press = useCallback(
    (delta: number) => {
      release();
      commit(delta, take() ?? valueRef.current);
      delay.current = setTimeout(() => {
        delay.current = null;
        repeat.current = setInterval(() => commit(delta), REPEAT_INTERVAL_MS);
      }, REPEAT_DELAY_MS);
    },
    [commit, release, take],
  );
  // NOTE: Unmounted mid-hold (navigating away, a re-key): no timer may outlive the control.
  useEffect(() => release, [release]);

  return { effects: { press, release } };
}
