import { useCallback, useMemo, useState } from 'react';
import { haptics } from '@/features/core/haptics';
import { useT } from '@/features/core/translations';
import type { Exercise } from '@/features/exercises';
import { defaultItemTarget, type RoutineId, useAddRoutineExercise, useRoutine } from '@/features/routines';
import { useSettings } from '@/features/settings';

/**
 * Picks into saved routine `routineId`. The opening targets come from `defaultItemTarget`, the
 * same function the draft store calls, so a row added here and a row added in the builder cannot
 * start out different.
 */
export function usePickIntoRoutineLogic(routineId: RoutineId) {
  const { t } = useT();
  const defaultRest = useSettings(settings => settings.defaultRestSeconds);
  const { routine } = useRoutine(routineId);
  const addExercise = useAddRoutineExercise();
  const [error, setError] = useState<string | null>(null);
  const ids = useMemo(() => (routine?.items ?? []).map(item => item.exerciseId), [routine]);
  const isIncluded = useCallback((exerciseId: string) => ids.includes(exerciseId), [ids]);
  const pick = useCallback(
    (exercise: Exercise) => {
      setError(null);
      addExercise
        .mutateAsync({ routineId, exercise, item: defaultItemTarget(defaultRest) })
        .then(() => haptics.success())
        .catch(() => {
          setError(t('routine.addFailed'));
          haptics.warning();
        });
    },
    [addExercise, defaultRest, routineId, t],
  );
  return { state: { error }, effects: { pick, isIncluded } };
}
