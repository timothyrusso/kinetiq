import { useCallback, useMemo } from 'react';
import {
  type SetStepperBaseInput,
  useSetStepperBase,
} from '@/features/core/design-system/display/SetStepperRow/setStepperBase';
import { useT } from '@/features/core/translations';

export interface DurationSetStepperRowInput extends SetStepperBaseInput {
  readonly onDuration: (index: number, durationSeconds: number) => void;
}

/** A timed set: the shared words and writers, then its time, in seconds. */
export function useDurationSetStepperRowLogic(input: DurationSetStepperRowInput) {
  const { index, onDuration } = input;
  const { t } = useT();
  const base = useSetStepperBase(input);
  const n = index + 1;
  const labels = useMemo(
    () => ({ ...base.labels, duration: t('tracking.setDurationA11y', { n }) }),
    [base.labels, n, t],
  );
  const changeDuration = useCallback(
    (durationSeconds: number) => onDuration(index, durationSeconds),
    [index, onDuration],
  );
  return { derived: { labels }, effects: { changeDuration, changeRpe: base.changeRpe, remove: base.remove } };
}
