import { router, useNavigation } from 'expo-router';
import { usePreventRemove } from 'expo-router/react-navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useScreenContentBottom } from '@/features/core/design-system';
import { errorTagToMessageKey } from '@/features/core/error';
import { haptics } from '@/features/core/haptics';
import { routes } from '@/features/core/navigation';
import { useT } from '@/features/core/translations';
import { estimateMinutes, plannedVolumeKg } from '@/features/routines/domain/utils/routinePlan';
import { useRoutineDraft } from '@/features/routines/facades/useRoutineDraft';
import { useSaveRoutine } from '@/features/routines/facades/useSaveRoutine';
import { useSettings } from '@/features/settings';

/**
 * Building a new routine: nothing is written until Done, and then once. A routine row created the
 * moment someone typed three characters and backed out would leak into the lists and the counts,
 * so the builder keeps a draft and asks before discarding it instead.
 *
 * Every way out (back gesture, hardware back, swipe, Cancel) passes the leave guard; a confirmed
 * discard replays the navigation the user started.
 */
export function useNewRoutinePageLogic() {
  const { t } = useT();
  const bottom = useScreenContentBottom();
  const navigation = useNavigation();
  const units = useSettings(settings => settings.unitSystem);
  const defaultRest = useSettings(settings => settings.defaultRestSeconds);
  const { draft, actions } = useRoutineDraft();
  const saveRoutine = useSaveRoutine();

  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [blocked, setBlocked] = useState<string | null>(null);
  const [savedId, setSavedId] = useState<string | null>(null);
  const pendingRemoval = useRef<Parameters<typeof navigation.dispatch>[0] | null>(null);

  // NOTE: opened during the first render, not in an effect: the draft always resets on open, and
  // an effect would show the last abandoned build for one frame first.
  useState(() => {
    actions.open(defaultRest);
    return null;
  });

  useEffect(() => {
    actions.setRestDefault(defaultRest);
  }, [actions, defaultRest]);

  const snapshotByExercise = useMemo(
    () => new Map(draft.snapshots.map(snapshot => [snapshot.exerciseId, snapshot])),
    [draft.snapshots],
  );
  const volumeKg = useMemo(() => plannedVolumeKg(draft.items), [draft.items]);
  const minutes = useMemo(() => estimateMinutes(draft.items), [draft.items]);
  // NOTE: `saved` counts as busy: the header must not change between the save and the screen's
  // removal, or Android applies it to a header it is already detaching and react-native-screens
  // crashes ("ScreenStackFragment added into a non-stack container").
  const busy = draft.status === 'saving' || draft.status === 'saved';

  useEffect(() => {
    if (savedId === null) return;
    // NOTE: one frame later, after the re-render that releases the leave guard: navigating in the
    // same tick hit the same Android header crash. Not `replace`: this is a modal, the routine a card.
    const frame = requestAnimationFrame(() => {
      router.dismiss();
      router.push(routes.routine(savedId));
    });
    return () => cancelAnimationFrame(frame);
  }, [savedId]);

  const { mutate } = saveRoutine;
  const save = useCallback(() => {
    if (!actions.isSavable()) {
      setBlocked(t('newRoutine.addOneFirst'));
      haptics.warning();
      return;
    }
    setBlocked(null);
    actions.markSaving();
    mutate(actions.toNewRoutine(), {
      onSuccess: saved => {
        actions.markSaved();
        haptics.success();
        // NOTE: not navigated from here: the leave guard still holds this render's "dirty", so a
        // navigation now is refused as a removal. The effect above navigates after the re-render.
        setSavedId(saved.id);
      },
      onError: error => {
        actions.markSaveFailed();
        setBlocked(
          error._tag === 'RoutineNameTaken' ? t(errorTagToMessageKey.RoutineNameTaken) : t('newRoutine.saveFailed'),
        );
        haptics.warning();
      },
    });
  }, [actions, mutate, t]);

  usePreventRemove(actions.isDirty(), ({ data }) => {
    pendingRemoval.current = data.action;
    setConfirmDiscard(true);
  });

  const cancel = useCallback(() => router.dismiss(), []);
  const openItem = useCallback((itemId: string) => router.push(routes.routineItem('draft', itemId)), []);
  const dropItem = useCallback(
    (itemId: string) => {
      haptics.light();
      actions.removeItem(itemId);
    },
    [actions],
  );
  const addExercise = useCallback(() => {
    haptics.light();
    router.push(routes.pickExercise('draft'));
  }, []);
  const keepEditing = useCallback(() => setConfirmDiscard(false), []);
  const discard = useCallback(() => {
    setConfirmDiscard(false);
    actions.clear();
    const action = pendingRemoval.current;
    pendingRemoval.current = null;
    if (action) navigation.dispatch(action);
    else router.dismiss();
  }, [actions, navigation]);

  const contentStyle = useMemo(() => ({ paddingBottom: bottom }), [bottom]);

  return {
    state: { draft, units, blocked, confirmDiscard, snapshotByExercise },
    derived: {
      volumeKg,
      minutes,
      busy,
      savable: draft.items.length > 0 && !busy,
      contentStyle,
    },
    effects: {
      save,
      cancel,
      openItem,
      dropItem,
      moveItem: actions.moveItem,
      setName: actions.setName,
      addExercise,
      keepEditing,
      discard,
    },
  };
}
