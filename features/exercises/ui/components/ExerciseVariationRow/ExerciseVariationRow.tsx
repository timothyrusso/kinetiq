import { memo } from 'react';
import { ExerciseRow } from '@/features/core/design-system';
import type { Theme } from '@/features/core/theme';
import type { Exercise } from '@/features/exercises/domain/schemas/ExerciseSchema';
import { useExerciseVariationRowLogic } from '@/features/exercises/ui/components/ExerciseVariationRow/ExerciseVariationRow.logic';

/** One exercise of the variation family; opens its own detail. */
export const ExerciseVariationRow = memo(function ExerciseVariationRow({
  exercise,
  current,
  theme,
  topDivider,
  onOpen,
}: {
  exercise: Exercise;
  /** The exercise on screen: dimmed, and a tap does nothing. */
  current: boolean;
  theme: Theme;
  topDivider: boolean;
  onOpen: (exerciseId: string) => void;
}) {
  const { derived, effects } = useExerciseVariationRowLogic(exercise, current, onOpen);
  return (
    <ExerciseRow
      name={exercise.name}
      uri={derived.uri}
      tags={derived.tags}
      theme={theme}
      dimmed={current}
      topDivider={topDivider}
      onPress={effects.open}
    />
  );
});
