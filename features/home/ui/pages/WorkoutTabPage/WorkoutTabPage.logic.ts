import { useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { useTabContentBottom } from '@/features/core/design-system';
import { haptics } from '@/features/core/haptics';
import { type HeaderMenuItem, routes } from '@/features/core/navigation';
import { type TKey, useT } from '@/features/core/translations';
import { useRoutines } from '@/features/routines';
import { useStartSession, useWorkoutRunning } from '@/features/workouts';

type Order = 'recent' | 'name';

/** Keys, not words: module scope has no language. Resolved where the control renders. */
const ORDER_SEGMENTS: readonly { value: Order; label: TKey }[] = [
  { value: 'recent', label: 'workoutTab.orderRecent' },
  { value: 'name', label: 'workoutTab.orderName' },
];

/**
 * The Workout tab, ordered by what the user is mid-way through: an in-flight session goes first
 * (it is unfinished and time-sensitive), then the two ways to start, then the routines.
 *
 * Starting offers the same two choices in the button row and in the header's menu, in the same
 * order: an empty workout, or a new routine. An empty workout has no exercises yet; they are
 * added from inside the player, which offers the picker while its list is empty. It is off while
 * a session runs, since there is one session at a time.
 *
 * The session is watched by the resume card, not by the screen: it republishes once a second
 * while a workout runs, and read here that tick re-rendered the whole tab. The screen asks only
 * the boolean "is one running". One card covers both "I am mid-set" and "the app was killed
 * mid-set": the launch restores an unfinished session paused, so both arrive as one object.
 */
export function useWorkoutTabPageLogic() {
  const { t, locale } = useT();
  const router = useRouter();
  const bottomSpace = useTabContentBottom();
  const routines = useRoutines();
  const [order, setOrder] = useState<Order>('recent');
  const resuming = useWorkoutRunning();
  const { start } = useStartSession();

  const sorted = useMemo(() => {
    const items = [...routines.routines];
    if (order === 'name') {
      items.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
      return items;
    }
    // NOTE: never-trained routines sort by creation, trained ones by last performed, and the
    // untrained group goes last: "recent" means what I have actually been doing.
    items.sort((a, b) => {
      if (a.lastPerformedAt === null && b.lastPerformedAt !== null) return 1;
      if (b.lastPerformedAt === null && a.lastPerformedAt !== null) return -1;
      if (a.lastPerformedAt !== null && b.lastPerformedAt !== null) return b.lastPerformedAt - a.lastPerformedAt;
      return b.createdAt - a.createdAt;
    });
    return items;
  }, [order, routines.routines]);

  const openRoutine = useCallback((id: string) => router.push(routes.routine(id)), [router]);
  const openNewRoutine = useCallback(() => router.push(routes.newRoutine()), [router]);
  const openSession = useCallback(() => router.push(routes.workoutSession()), [router]);
  const startEmpty = useCallback(() => {
    if (resuming) return;
    start({ routineId: null, name: t('workoutTab.emptyWorkoutName'), items: [] }, () => {
      haptics.success();
      openSession();
    });
  }, [openSession, resuming, start, t]);
  const { refresh } = routines;
  const retry = useCallback(() => void refresh(), [refresh]);
  const orderSegments = useMemo(() => ORDER_SEGMENTS.map(seg => ({ value: seg.value, label: t(seg.label) })), [t]);
  const startMenu = useMemo<HeaderMenuItem[]>(
    () => [
      { key: 'empty', label: t('workoutTab.startEmpty'), sf: 'play', onPress: startEmpty, disabled: resuming },
      { key: 'routine', label: t('workout.newRoutine'), sf: 'plus', onPress: openNewRoutine },
    ],
    [openNewRoutine, resuming, startEmpty, t],
  );

  return {
    state: {
      resuming,
      order,
      sorted,
      count: routines.count,
      showOrder: routines.routines.length > 1,
      isLoading: routines.isLoading,
      error: routines.error,
      isEmpty: routines.isEmpty,
      bottomSpace,
      locale,
    },
    derived: { orderSegments, startMenu },
    effects: { setOrder, openRoutine, openNewRoutine, openSession, startEmpty, retry },
  };
}
