import { useCallback, useMemo } from 'react';
import type { AccessibilityActionEvent, AccessibilityActionInfo } from 'react-native';
import { exerciseTags } from '@/features/core/design-system';
import { useT } from '@/features/core/translations';
import type { Exercise } from '@/features/exercises/domain/schemas/ExerciseSchema';
import { exerciseImageSource } from '@/features/exercises/mappers/exerciseImageSource';

/**
 * A result's taxonomy tags and bundled thumbnail, built once per exercise, and its two presses,
 * each handing back its id: the row adds the exercise, the info button opens its page. The row is
 * one accessible element, so the info button also reaches a screen reader as the row's action.
 */
export function useExercisePickerRowLogic(
  exercise: Exercise,
  onSelect: (exerciseId: string) => void,
  onInfo: (exerciseId: string) => void,
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
  return {
    derived: { tags, image, infoLabel, accessibilityActions },
    effects: { select, info, onAccessibilityAction },
  };
}
