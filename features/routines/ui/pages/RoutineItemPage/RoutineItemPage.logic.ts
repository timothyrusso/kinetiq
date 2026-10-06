import { router, useIsFocused, useLocalSearchParams } from 'expo-router';
import { useCallback, useMemo } from 'react';
import { closeSheet, type ExerciseAboutContent } from '@/features/core/design-system';
import { haptics } from '@/features/core/haptics';
import { routes } from '@/features/core/navigation';
import { useT } from '@/features/core/translations';
import { useExerciseAbout } from '@/features/exercises';
import type { ItemChange } from '@/features/routines/domain/entities/ItemTarget';
import type { TrackingType } from '@/features/routines/domain/schemas/RoutineSchema';
import { itemAs } from '@/features/routines/domain/utils/itemTargets';
import { routineIdOf } from '@/features/routines/domain/utils/routineId';
import { useRoutine } from '@/features/routines/facades/useRoutine';
import { useRoutineDraft } from '@/features/routines/facades/useRoutineDraft';
import { useRemoveRoutineItem, useSetRoutineItem } from '@/features/routines/facades/useRoutineMutations';
import { useSettings } from '@/features/settings';

/**
 * One routine item's targets, from the builder (`target=draft`, written into the draft) or from a
 * saved routine (`target=routine&id=`, written through the item mutation). Both sources are read
 * unconditionally; the one the route does not name is empty or disabled. The About block's photo
 * moves while this sheet is the focused screen, and its link pushes the exercise page over the
 * sheet, so back returns to it.
 */
export function useRoutineItemPageLogic() {
  const { t } = useT();
  const params = useLocalSearchParams<{ target?: string; id?: string; item: string }>();
  const itemId = typeof params.item === 'string' ? params.item : '';
  const routineId = params.target === 'routine' ? routineIdOf(params.id) : null;
  const units = useSettings(settings => settings.unitSystem);

  const { draft, actions } = useRoutineDraft();
  const saved = useRoutine(routineId);
  const setItem = useSetRoutineItem();
  const removeItem = useRemoveRoutineItem();

  const item = useMemo(
    () => (routineId === null ? draft.items : (saved.routine?.items ?? [])).find(row => row.id === itemId) ?? null,
    [draft.items, itemId, routineId, saved.routine],
  );
  const snapshot = useMemo(() => {
    if (item === null) return null;
    if (routineId !== null) return saved.snapshots.get(item.exerciseId) ?? null;
    return draft.snapshots.find(row => row.exerciseId === item.exerciseId) ?? null;
  }, [draft.snapshots, item, routineId, saved.snapshots]);

  const { change: writeItem } = setItem;
  const change = useCallback(
    (update: ItemChange) => {
      if (routineId === null) {
        actions.updateItem(itemId, update);
        return;
      }
      // NOTE: fire and forget: a stepper fires on every tap, and a pending state per press would
      // make the sheet feel broken for a one-row update.
      writeItem({ routineId, itemId, change: update }, { onError: () => haptics.warning() });
    },
    [actions, itemId, routineId, writeItem],
  );

  // NOTE: reps carry between the two types that count them, the weight is dropped, and sets to or
  // from a timed type open on that type's defaults (`itemAs`).
  const setTrackingType = useCallback((type: TrackingType) => change(item => itemAs(item, type)), [change]);

  const { mutate: dropItem } = removeItem;
  const remove = useCallback(() => {
    if (routineId === null) {
      actions.removeItem(itemId);
    } else {
      haptics.light();
      dropItem({ routineId, itemId }, { onError: () => haptics.warning() });
    }
    closeSheet();
  }, [actions, dropItem, itemId, routineId]);

  const exerciseId = item?.exerciseId ?? null;
  const aboutContent = useExerciseAbout(exerciseId);
  const focused = useIsFocused();
  const openExercise = useCallback(() => {
    if (exerciseId !== null) router.push(routes.exerciseDetail(exerciseId, true));
  }, [exerciseId]);
  const about = useMemo<ExerciseAboutContent>(() => ({ ...aboutContent, animating: focused }), [aboutContent, focused]);

  const title = item?.exerciseName ?? (routineId === null ? '' : t('routine.title'));

  return {
    state: { item, snapshot, units },
    derived: { title, about },
    effects: { change, setTrackingType, remove, openExercise },
  };
}
