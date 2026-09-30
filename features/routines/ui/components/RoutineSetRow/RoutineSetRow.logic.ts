import { useCallback, useMemo } from 'react';
import { useT } from '@/features/core/translations';

export interface RoutineSetRowInput {
  readonly index: number;
  readonly unit: string;
  readonly onReps: (index: number, reps: number) => void;
  readonly onWeight: (index: number, weight: number) => void;
  readonly onRpe: (index: number, rpe: number) => void;
  readonly onRemove: (index: number) => void;
}

/**
 * The row's spoken labels, each naming its set, and its writers, each handing the row's own index
 * to the editor's shared callbacks so `memo` skips the rows a press did not touch.
 */
export function useRoutineSetRowLogic({ index, unit, onReps, onWeight, onRpe, onRemove }: RoutineSetRowInput) {
  const { t } = useT();
  const n = index + 1;
  const labels = useMemo(
    () => ({
      title: t('itemEditor.setNumber', { n }),
      reps: t('itemEditor.setRepsA11y', { n }),
      weight: t('itemEditor.setWeightA11y', { n, unit }),
      rpe: t('itemEditor.setRpeA11y', { n }),
      remove: t('itemEditor.removeSetA11y', { n }),
    }),
    [n, t, unit],
  );
  const changeReps = useCallback((reps: number) => onReps(index, reps), [index, onReps]);
  const changeWeight = useCallback((weight: number) => onWeight(index, weight), [index, onWeight]);
  const changeRpe = useCallback((rpe: number) => onRpe(index, rpe), [index, onRpe]);
  const remove = useCallback(() => onRemove(index), [index, onRemove]);
  return { derived: { labels }, effects: { changeReps, changeWeight, changeRpe, remove } };
}
