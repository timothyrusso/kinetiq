import { useCallback, useMemo } from 'react';
import type { PressableStateCallbackType, StyleProp, ViewStyle } from 'react-native';
import { type IconName, type MetaItem, useStyles } from '@/features/core/design-system';
import type { StrengthEntry, TrackingType } from '@/features/workouts/domain/schemas/StrengthEntrySchema';
import { createStyles } from '@/features/workouts/ui/components/ExerciseBlock/ExerciseBlock.style';

/** The icon beside last time's value, the same one the exercise's summary uses for what it records. */
const PREVIOUS_ICON: Record<TrackingType, IconName> = {
  weightReps: 'dumbbell',
  repsOnly: 'refresh',
  duration: 'timer',
};

export interface ExerciseBlockInput {
  readonly entry: StrengthEntry;
  readonly entryIndex: number;
  /**
   * Rendered verbatim. The caller decides between "Last time 82.5 kg × 5" (or "12 reps", "1:30"),
   * "No previous sessions yet" and nothing, because only it knows whether the history read has
   * answered.
   */
  readonly previousLabel: string | null;
  /** When that was ("3w ago"), or `null` when there is no previous workout to date. */
  readonly previousWhen: string | null;
  readonly onAddSet: (entryIndex: number) => void;
  readonly onSkip: (entryIndex: number) => void;
  readonly onRequestRemove: (entryIndex: number) => void;
  /** Opens the exercise's sheet, making it current. */
  readonly onOpen: (entryIndex: number) => void;
}

/**
 * The block's counts, its previous-performance items and its presses. The items are built here
 * from the two strings, not handed in as a list: the screen re-renders every second for its
 * clock, and a fresh list per tick would defeat the block's `memo`.
 */
export function useExerciseBlockLogic({
  entry,
  entryIndex,
  previousLabel,
  previousWhen,
  onAddSet,
  onSkip,
  onRequestRemove,
  onOpen,
}: ExerciseBlockInput) {
  const styles = useStyles(createStyles);
  const done = entry.sets.filter(set => set.completed).length;
  const { trackingType } = entry;
  const previous = useMemo<MetaItem[]>(() => {
    if (previousLabel === null) return [];
    if (previousWhen === null) return [{ icon: 'info', label: previousLabel }];
    return [
      { icon: PREVIOUS_ICON[trackingType], label: previousLabel },
      { icon: 'calendar', label: previousWhen },
    ];
  }, [previousLabel, previousWhen, trackingType]);
  const headStyle = useCallback(
    ({ pressed }: PressableStateCallbackType): StyleProp<ViewStyle> => [
      styles.head,
      pressed ? styles.headPressed : null,
    ],
    [styles],
  );
  const textActionStyle = useCallback(
    ({ pressed }: PressableStateCallbackType): StyleProp<ViewStyle> => [
      styles.textAction,
      pressed ? styles.textActionPressed : null,
    ],
    [styles],
  );
  const open = useCallback(() => onOpen(entryIndex), [onOpen, entryIndex]);
  const addSet = useCallback(() => onAddSet(entryIndex), [onAddSet, entryIndex]);
  const skip = useCallback(() => onSkip(entryIndex), [onSkip, entryIndex]);
  const remove = useCallback(() => onRequestRemove(entryIndex), [onRequestRemove, entryIndex]);
  return {
    derived: {
      done,
      allDone: done === entry.sets.length && entry.sets.length > 0,
      hasCue: entry.notes !== null && entry.notes.length > 0,
      previous,
      headStyle,
      textActionStyle,
    },
    effects: { open, addSet, skip, remove },
  };
}
