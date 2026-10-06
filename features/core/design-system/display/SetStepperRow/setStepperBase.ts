import { useCallback, useMemo } from 'react';
import { useT } from '@/features/core/translations';

/**
 * What the RPE stepper adjusts: a routine plans a target, a workout records the effort a set
 * took. Only the words differ.
 */
export type SetRpeKind = 'target' | 'logged';

/** What every set row takes, whatever its type records. */
export interface SetStepperBaseInput {
  readonly index: number;
  readonly rpeKind: SetRpeKind;
  readonly completed: boolean;
  readonly onRpe: (index: number, rpe: number) => void;
  readonly onRemove: (index: number) => void;
}

const RPE_KEYS = {
  target: { label: 'itemEditor.targetRpe', a11y: 'itemEditor.setRpeA11y' },
  logged: { label: 'itemEditor.rpe', a11y: 'itemEditor.setLoggedRpeA11y' },
} as const;

/**
 * The words and writers every set row shares: its title, its done state, its RPE and its remove
 * button, each spoken label naming the set and each writer handing the row's own index to the
 * editor's shared callbacks, so `memo` skips the rows a press did not touch. Each type's row adds
 * the steppers for what it records.
 */
export function useSetStepperBase({ index, rpeKind, completed, onRpe, onRemove }: SetStepperBaseInput) {
  const { t } = useT();
  const n = index + 1;
  const labels = useMemo(
    () => ({
      title: t('itemEditor.setNumber', { n }),
      titleA11y: completed ? t('itemEditor.setDoneA11y', { n }) : t('itemEditor.setNumber', { n }),
      rpeLabel: t(RPE_KEYS[rpeKind].label),
      rpe: t(RPE_KEYS[rpeKind].a11y, { n }),
      remove: t('itemEditor.removeSetA11y', { n }),
    }),
    [completed, n, rpeKind, t],
  );
  const changeRpe = useCallback((rpe: number) => onRpe(index, rpe), [index, onRpe]);
  const remove = useCallback(() => onRemove(index), [index, onRemove]);
  return { labels, changeRpe, remove };
}
