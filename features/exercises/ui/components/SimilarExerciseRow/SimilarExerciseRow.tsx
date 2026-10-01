import { memo } from 'react';
import { ExerciseRow } from '@/features/core/design-system';
import type { Theme } from '@/features/core/theme';
import type { Exercise } from '@/features/exercises/domain/schemas/ExerciseSchema';
import { useSimilarExerciseRowLogic } from '@/features/exercises/ui/components/SimilarExerciseRow/SimilarExerciseRow.logic';

/** One similar exercise; opens its own detail. */
export const SimilarExerciseRow = memo(function SimilarExerciseRow({
  exercise,
  theme,
  topDivider,
  onOpen,
}: {
  exercise: Exercise;
  theme: Theme;
  topDivider: boolean;
  onOpen: (exerciseId: string) => void;
}) {
  const { derived, effects } = useSimilarExerciseRowLogic(exercise, onOpen);
  return (
    <ExerciseRow
      name={exercise.name}
      image={derived.image}
      tags={derived.tags}
      theme={theme}
      topDivider={topDivider}
      onPress={effects.open}
    />
  );
});
