import { useCallback, useMemo } from 'react';
import {
  type SetStepperBaseInput,
  useSetStepperBase,
} from '@/features/core/design-system/display/SetStepperRow/setStepperBase';
import { useT } from '@/features/core/translations';

export type { SetRpeKind } from '@/features/core/design-system/display/SetStepperRow/setStepperBase';

export interface SetStepperRowInput extends SetStepperBaseInput {
  readonly unit: string;
  readonly onReps: (index: number, reps: number) => void;
  readonly onWeight: (index: number, weight: number) => void;
}

/** A loaded set's words and writers: the shared ones, then its reps and its weight. */
export function useSetStepperRowLogic(input: SetStepperRowInput) {
  const { index, unit, onReps, onWeight } = input;
  const { t } = useT();
  const base = useSetStepperBase(input);
  const n = index + 1;
  const labels = useMemo(
    () => ({
      ...base.labels,
      reps: t('itemEditor.setRepsA11y', { n }),
      weight: t('itemEditor.setWeightA11y', { n, unit }),
    }),
    [base.labels, n, t, unit],
  );
  const changeReps = useCallback((reps: number) => onReps(index, reps), [index, onReps]);
  const changeWeight = useCallback((weight: number) => onWeight(index, weight), [index, onWeight]);
  return {
    derived: { labels },
    effects: { changeReps, changeWeight, changeRpe: base.changeRpe, remove: base.remove },
  };
}
