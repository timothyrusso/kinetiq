import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { type MetaItem, useScreenContentBottom } from '@/features/core/design-system';
import { haptics } from '@/features/core/haptics';
import { type HeaderMenuItem, routes } from '@/features/core/navigation';
import { useT } from '@/features/core/translations';
import { agoLabel, moveItem } from '@/features/core/utils';
import { routineIdOf } from '@/features/routines/domain/utils/routineId';
import { estimateMinutes, plannedVolumeKg } from '@/features/routines/domain/utils/routinePlan';
import { useRoutine } from '@/features/routines/facades/useRoutine';
import {
  useDeleteRoutine,
  useDuplicateRoutine,
  useRemoveRoutineItem,
  useReorderRoutine,
} from '@/features/routines/facades/useRoutineMutations';
import { useSettings } from '@/features/settings';
import { useWorkoutSession } from '@/workout/session';
import { useStartRoutine } from '@/workout/startRoutine';

/**
 * A saved routine: the plan, and the controls around it.
 *
 * Every edit writes on change and there is no Done button: the routine already exists, so a row
 * changed and then left must stay changed. Everything comes from SQLite, the exercises having been
 * frozen into stored snapshots when they were added, so the screen renders the same with no
 * network and has nothing remote to refresh.
 *
 * Previous performance is not shown here: it is on the session screen, where the set is entered,
 * and computing it scans the recent workouts. `timesCompleted` and `lastPerformedAt` are columns on
 * the routine itself.
 */
export function useRoutinePageLogic() {
  const { t } = useT();
  const bottom = useScreenContentBottom();
  const params = useLocalSearchParams<{ id: string }>();
  const id = routineIdOf(params.id);

  const units = useSettings(settings => settings.unitSystem);
  const defaultRest = useSettings(settings => settings.defaultRestSeconds);
  const { routine, snapshots, missing, isLoading, error, refresh } = useRoutine(id);
  const { session } = useWorkoutSession();

  const [confirmDelete, setConfirmDelete] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);

  const reorder = useReorderRoutine();
  const removeItem = useRemoveRoutineItem();
  const duplicate = useDuplicateRoutine();
  const destroy = useDeleteRoutine();
  const { start, busy: starting } = useStartRoutine();

  const items = useMemo(() => routine?.items ?? [], [routine]);
  const volumeKg = useMemo(() => plannedVolumeKg(items), [items]);
  const minutes = useMemo(() => estimateMinutes(items), [items]);

  // NOTE: any running session, not only this routine's: the store holds one, so starting a second
  // would silently replace a workout the user is in the middle of.
  const liveSession = session !== null && (session.status === 'active' || session.status === 'paused');
  const liveName = session?.routineName;

  const warn = useCallback((message: string) => {
    setFailed(message);
    haptics.warning();
  }, []);

  const begin = useCallback(() => {
    if (routine === null) return;
    start({
      routineId: routine.id,
      routineName: routine.name,
      items: routine.items,
      defaultRestSeconds: defaultRest,
      onResult: started => {
        if (!started) {
          warn(t('routine.noExercisesYet'));
          return;
        }
        haptics.success();
        router.push(routes.workoutSession());
      },
    });
  }, [defaultRest, routine, start, t, warn]);

  const routineId = routine?.id ?? null;
  const { mutate: reorderItems } = reorder;
  const move = useCallback(
    (from: number, to: number) => {
      if (routineId === null) return;
      reorderItems(
        { id: routineId, orderedItemIds: moveItem(items, from, to).map(item => item.id) },
        { onError: () => warn(t('routine.reorderFailed')) },
      );
      haptics.selection();
    },
    [items, reorderItems, routineId, t, warn],
  );

  const { mutate: dropItem } = removeItem;
  const remove = useCallback(
    (itemId: string) => {
      if (routineId === null) return;
      haptics.light();
      dropItem({ routineId, itemId }, { onError: () => warn(t('routine.removeFailed')) });
    },
    [dropItem, routineId, t, warn],
  );

  const { mutate: copy } = duplicate;
  const doDuplicate = useCallback(() => {
    if (routineId === null) return;
    copy(routineId, {
      onSuccess: created => {
        haptics.success();
        // NOTE: `replace`, not `push`: a back gesture onto the original would offer to duplicate again.
        router.replace(routes.routine(created.id));
      },
      onError: () => warn(t('routine.duplicateFailed')),
    });
  }, [copy, routineId, t, warn]);

  const { mutate: erase } = destroy;
  const doDelete = useCallback(() => {
    if (routineId === null) return;
    erase(routineId, {
      onSuccess: () => {
        setConfirmDelete(false);
        haptics.medium();
        // NOTE: a deep link has nothing to go back to; the tab that lists routines is the way on.
        if (router.canGoBack()) router.back();
        else router.replace(routes.workoutTab());
      },
      onError: () => warn(t('routine.deleteFailed')),
    });
  }, [erase, routineId, t, warn]);

  const options = useMemo<HeaderMenuItem[]>(
    () => [
      {
        key: 'rename',
        label: t('routine.rename'),
        sf: 'pencil',
        onPress: () => {
          if (routineId !== null) router.push(routes.renameRoutine(routineId));
        },
      },
      { key: 'duplicate', label: t('routine.duplicate'), sf: 'plus.square.on.square', onPress: doDuplicate },
      {
        key: 'delete',
        label: t('routine.deleteRoutine'),
        sf: 'trash',
        destructive: true,
        onPress: () => setConfirmDelete(true),
      },
    ],
    [doDuplicate, routineId, t],
  );

  // NOTE: the header's play says which workout is running rather than opening a second one.
  const startFromHeader = useCallback(() => {
    if (liveSession) {
      warn(liveName ? t('routine.liveNamed', { name: liveName }) : t('routine.liveUnnamed'));
      return;
    }
    begin();
  }, [begin, liveName, liveSession, t, warn]);

  // NOTE: the button at the end of the plan opens the running workout, or starts this one.
  const primary = useCallback(() => {
    if (liveSession) {
      router.push(routes.workoutSession());
      return;
    }
    begin();
  }, [begin, liveSession]);

  const openItem = useCallback(
    (itemId: string) => {
      if (routineId !== null) router.push(routes.routineItem('routine', itemId, routineId));
    },
    [routineId],
  );
  const addExercise = useCallback(() => {
    if (routineId === null) return;
    haptics.light();
    router.push(routes.pickExercise('routine', routineId));
  }, [routineId]);
  const backToWorkouts = useCallback(() => router.replace(routes.workoutTab()), []);
  const cancelDelete = useCallback(() => setConfirmDelete(false), []);
  const retry = useCallback(() => void refresh(), [refresh]);

  const lastPerformedAt = routine?.lastPerformedAt ?? null;
  const summary = useMemo<MetaItem[]>(
    () => [
      { icon: 'layers', label: `${items.length} ${t('routine.exerciseWord', { count: items.length })}` },
      ...(volumeKg === 0 && items.length > 0 ? [{ icon: 'dumbbell' as const, label: t('routine.bodyweight') }] : []),
      ...(lastPerformedAt === null
        ? []
        : [{ icon: 'calendar' as const, label: t('details.lastTrained', { ago: agoLabel(lastPerformedAt) }) }]),
    ],
    [items.length, lastPerformedAt, t, volumeKg],
  );

  const timesCompleted = routine?.timesCompleted ?? 0;
  const deleteMessage =
    timesCompleted > 0
      ? t('routine.deleteCompleted', { count: timesCompleted, word: t('routine.timeWord', { count: timesCompleted }) })
      : t('routine.deleteNever');

  const contentStyle = useMemo(() => ({ paddingBottom: bottom }), [bottom]);

  return {
    state: {
      routine,
      snapshots,
      units,
      isLoading,
      error,
      missing,
      failed,
      confirmDelete,
      starting,
      liveSession,
    },
    derived: { items, volumeKg, minutes, summary, options, deleteMessage, contentStyle },
    effects: {
      retry,
      startFromHeader,
      primary,
      move,
      remove,
      openItem,
      addExercise,
      backToWorkouts,
      doDelete,
      cancelDelete,
    },
  };
}
