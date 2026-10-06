import { useCallback, useMemo } from 'react';
import {
  type SetStepperBaseInput,
  useSetStepperBase,
} from '@/features/core/design-system/display/SetStepperRow/setStepperBase';
import { useT } from '@/features/core/translations';

export interface RepsSetStepperRowInput extends SetStepperBaseInput {
  readonly onReps: (index: number, reps: number) => void;
}

/** A set counted in reps alone: the shared words and writers, then its reps. */
export function useRepsSetStepperRowLogic(input: RepsSetStepperRowInput) {
  const { index, onReps } = input;
  const { t } = useT();
  const base = useSetStepperBase(input);
  const n = index + 1;
  const labels = useMemo(() => ({ ...base.labels, reps: t('itemEditor.setRepsA11y', { n }) }), [base.labels, n, t]);
  const changeReps = useCallback((reps: number) => onReps(index, reps), [index, onReps]);
  return { derived: { labels }, effects: { changeReps, changeRpe: base.changeRpe, remove: base.remove } };
}
