import { useCallback, useMemo } from 'react';
import type { AccessibilityActionEvent, AccessibilityActionInfo } from 'react-native';
import { exerciseTags } from '@/features/core/design-system';
import { useT } from '@/features/core/translations';
import type { Exercise } from '@/features/exercises/domain/schemas/ExerciseSchema';
import { exerciseImageSource } from '@/features/exercises/mappers/exerciseImageSource';
import type { PickDestination } from '@/features/exercises/ui/pages/PickExercisePage/PickExercisePage.logic';

/** Whether the exercise is in the destination already, and what a tap on it would do. */
export interface PickerRowState {
  readonly included: boolean;
  readonly removable: boolean;
  readonly locked: string | null;
  readonly destination: PickDestination;
}

const HINT_KEYS = {
  routine: { add: 'states.addsToRoutine', remove: 'states.removesFromRoutine', inert: 'states.alreadyInRoutine' },
  workout: { add: 'states.addsToWorkout', remove: 'states.removesFromWorkout', inert: 'states.alreadyInWorkout' },
} as const;

/**
 * A result's taxonomy tags and bundled thumbnail, built once per exercise, and its two presses,
 * each handing back its id: the row adds or removes the exercise, the info button opens its page.
 * The row is one accessible element, so the info button also reaches a screen reader as the row's
 * action. Its hint says what a tap does in this destination, or why it does nothing.
 */
export function useExercisePickerRowLogic(
  exercise: Exercise,
  onSelect: (exerciseId: string) => void,
  onInfo: (exerciseId: string) => void,
  { included, removable, locked, destination }: PickerRowState,
) {
  const { t } = useT();
  const tags = useMemo(() => exerciseTags(exercise), [exercise]);
  const image = useMemo(
    () => exerciseImageSource(exercise.thumbnailUrl) ?? exerciseImageSource(exercise.imageUrl),
    [exercise.imageUrl, exercise.thumbnailUrl],
  );
  const select = useCallback(() => onSelect(exercise.id), [exercise.id, onSelect]);
  const info = useCallback(() => onInfo(exercise.id), [exercise.id, onInfo]);
  const infoLabel = t('exerciseDetail.openA11y', { name: exercise.name });
  const accessibilityActions = useMemo<AccessibilityActionInfo[]>(
    () => [{ name: 'info', label: infoLabel }],
    [infoLabel],
  );
  const onAccessibilityAction = useCallback(
    (event: AccessibilityActionEvent) => {
      if (event.nativeEvent.actionName === 'info') info();
    },
    [info],
  );
  const selected = included && removable && locked === null;
  const inert = included && !selected;
  const keys = HINT_KEYS[destination];
  const hint = locked ?? t(selected ? keys.remove : inert ? keys.inert : keys.add);
  return {
    derived: { tags, image, infoLabel, accessibilityActions, selected, inert, hint },
    effects: { select, info, onAccessibilityAction },
  };
}
