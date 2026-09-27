import { useCallback } from 'react';
import type { PressableStateCallbackType, StyleProp, ViewStyle } from 'react-native';
import { useStyles } from '@/features/core/design-system';
import { useT } from '@/features/core/translations';
import { formatWeight, type UnitSystem } from '@/features/core/utils';
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

/** A set's labels, the look of its two value cells, and its presses, handing back its position. */
export function useSetRowLogic({ entryIndex, setIndex, set, units, isTarget, onOpen, onToggle }: SetRowInput) {
  const { t } = useT();
  const styles = useStyles(createStyles);
  const weightText = set.weightKg === 0 ? t('setRow.bodyweight') : formatWeight(set.weightKg, units);
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
  return { derived: { weightText, number: setIndex + 1, valueStyle }, effects: { open, toggle } };
}
