import { useCallback, useMemo } from 'react';
import type { PressableStateCallbackType, StyleProp, ViewStyle } from 'react-native';
import { useStyles } from '@/features/core/design-system';
import { useT } from '@/features/core/translations';
import { formatTimer, formatWeight, trimNumber, type UnitSystem, weightUnit } from '@/features/core/utils';
import type { StrengthSet } from '@/features/workouts/domain/schemas/StrengthEntrySchema';
import { createStyles } from '@/features/workouts/ui/components/SetRow/SetRow.style';

export interface SetRowInput {
  readonly entryIndex: number;
  readonly setIndex: number;
  readonly set: StrengthSet;
  readonly units: UnitSystem;
  /** The next unticked set: the one the lifter is working toward right now. */
  readonly isTarget: boolean;
  readonly onOpen: (entryIndex: number, setIndex: number) => void;
  readonly onToggle: (entryIndex: number, setIndex: number) => void;
}

/** One value cell of the row: what it holds, the value, and what a screen reader says for it. */
export interface SetCell {
  readonly label: string;
  readonly value: string;
  readonly a11y: string;
}

/**
 * A set's value cells in what its type records, its labels and its presses, handing back its
 * position. A loaded set has two cells, reps and weight (a bodyweight one says so); a reps-only
 * set has its reps alone; a timed set its time, as `m:ss`.
 */
export function useSetRowLogic({ entryIndex, setIndex, set, units, isTarget, onOpen, onToggle }: SetRowInput) {
  const { t } = useT();
  const styles = useStyles(createStyles);
  const n = setIndex + 1;
  const cells = useMemo<{ primary: SetCell; secondary: SetCell | null }>(() => {
    switch (set.type) {
      case 'weightReps': {
        const weight = set.weightKg === 0 ? t('setRow.bodyweight') : formatWeight(set.weightKg, units);
        return {
          primary: {
            label: t('setRow.reps'),
            value: String(set.reps),
            a11y: t('setRow.setRepsAt', { n, reps: set.reps, weight }),
          },
          secondary: {
            label: t('setRow.weightIn', { unit: weightUnit(units) }),
            value: set.weightKg === 0 ? t('setRow.bodyweightShort') : trimNumber(set.weightKg),
            a11y: t('setRow.setWeight', { n, weight }),
          },
        };
      }
      case 'repsOnly':
        return {
          primary: {
            label: t('setRow.reps'),
            value: String(set.reps),
            a11y: t('tracking.setReps', { n, reps: set.reps }),
          },
          secondary: null,
        };
      case 'duration': {
        const time = formatTimer(set.durationSeconds);
        return {
          primary: { label: t('tracking.time'), value: time, a11y: t('tracking.setTime', { n, time }) },
          secondary: null,
        };
      }
    }
  }, [n, set, t, units]);
  const outlined = isTarget && !set.completed;
  const valueStyle = useCallback(
    ({ pressed }: PressableStateCallbackType): StyleProp<ViewStyle> => [
      styles.value,
      pressed ? styles.valuePressed : null,
      outlined ? styles.valueTarget : null,
    ],
    [outlined, styles],
  );
  const open = useCallback(() => onOpen(entryIndex, setIndex), [onOpen, entryIndex, setIndex]);
  const toggle = useCallback(() => onToggle(entryIndex, setIndex), [onToggle, entryIndex, setIndex]);
  return { derived: { ...cells, number: n, valueStyle }, effects: { open, toggle } };
}
