import { useCallback, useMemo } from 'react';
import { useT } from '@/features/core/translations';

/**
 * What the RPE stepper adjusts: a routine plans a target, a workout records the effort a set
 * took. Only the words differ.
 */
export type SetRpeKind = 'target' | 'logged';

export interface SetStepperRowInput {
  readonly index: number;
  readonly unit: string;
  readonly rpeKind: SetRpeKind;
  readonly completed: boolean;
  readonly onReps: (index: number, reps: number) => void;
  readonly onWeight: (index: number, weight: number) => void;
  readonly onRpe: (index: number, rpe: number) => void;
  readonly onRemove: (index: number) => void;
}

const RPE_KEYS = {
  target: { label: 'itemEditor.targetRpe', a11y: 'itemEditor.setRpeA11y' },
  logged: { label: 'itemEditor.rpe', a11y: 'itemEditor.setLoggedRpeA11y' },
} as const;

/**
 * The row's words, each spoken label naming its set, and its writers, each handing the row's own
 * index to the editor's shared callbacks so `memo` skips the rows a press did not touch.
 */
export function useSetStepperRowLogic({
  index,
  unit,
  rpeKind,
  completed,
  onReps,
  onWeight,
  onRpe,
  onRemove,
}: SetStepperRowInput) {
  const { t } = useT();
  const n = index + 1;
  const labels = useMemo(
    () => ({
      title: t('itemEditor.setNumber', { n }),
      titleA11y: completed ? t('itemEditor.setDoneA11y', { n }) : t('itemEditor.setNumber', { n }),
      reps: t('itemEditor.setRepsA11y', { n }),
      weight: t('itemEditor.setWeightA11y', { n, unit }),
      rpeLabel: t(RPE_KEYS[rpeKind].label),
      rpe: t(RPE_KEYS[rpeKind].a11y, { n }),
      remove: t('itemEditor.removeSetA11y', { n }),
    }),
    [completed, n, rpeKind, t, unit],
  );
  const changeReps = useCallback((reps: number) => onReps(index, reps), [index, onReps]);
  const changeWeight = useCallback((weight: number) => onWeight(index, weight), [index, onWeight]);
  const changeRpe = useCallback((rpe: number) => onRpe(index, rpe), [index, onRpe]);
  const remove = useCallback(() => onRemove(index), [index, onRemove]);
  return { derived: { labels }, effects: { changeReps, changeWeight, changeRpe, remove } };
}
