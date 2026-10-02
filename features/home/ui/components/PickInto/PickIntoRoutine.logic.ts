import { useCallback, useMemo, useState } from 'react';
import { haptics } from '@/features/core/haptics';
import { useT } from '@/features/core/translations';
import type { Exercise } from '@/features/exercises';
import type { PickDestination } from '@/features/exercises/pages';
import {
  defaultItemTarget,
  type RoutineId,
  useAddRoutineExercise,
  useRemoveRoutineItem,
  useRoutine,
} from '@/features/routines';
import { useSettings } from '@/features/settings';

const DESTINATION: PickDestination = 'routine';

/**
 * Picks into saved routine `routineId`. The opening targets come from `defaultItemTarget`, the
 * same function the draft store calls, so a row added here and a row added in the builder cannot
 * start out different. A tap on an included exercise removes its item with the routine screen's
 * own remove mutation, so the positions behind it renumber the same way; with the exercise in
 * twice, the later item goes, the one a mistaken add would have made.
 */
export function usePickIntoRoutineLogic(routineId: RoutineId) {
  const { t } = useT();
  const defaultRest = useSettings(settings => settings.defaultRestSeconds);
  const { routine } = useRoutine(routineId);
  const addExercise = useAddRoutineExercise();
  const removeItem = useRemoveRoutineItem();
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
  const items = routine?.items;
  const { mutateAsync: dropItem } = removeItem;
  const unpick = useCallback(
    (exerciseId: string) => {
      const item = items?.findLast(row => row.exerciseId === exerciseId);
      if (item === undefined) return;
      setError(null);
      dropItem({ routineId, itemId: item.id })
        .then(() => haptics.light())
        .catch(() => {
          setError(t('routine.removeFailed'));
          haptics.warning();
        });
    },
    [dropItem, items, routineId, t],
  );
  return { state: { error, destination: DESTINATION }, effects: { pick, unpick, isIncluded } };
}
