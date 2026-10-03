import { useCallback } from 'react';
import { type PickRemoval, pickRemoval } from '@/features/workouts/domain/utils/pickRemoval';
import { useSessionStore } from '@/features/workouts/state/sessionStore';

/**
 * Taking an exercise back out of the workout in progress from the picker, with no confirmation:
 * only one with no completed set, the workout's last included. `removalOf` says what a tap would
 * do and changes only when the exercises do, not on the clock's ticks; `remove` judges the
 * session as it is when called and answers whether it removed anything.
 */
export function useRemoveSessionExercise() {
  const entries = useSessionStore(state => state.session?.entries);
  const removalOf = useCallback(
    (exerciseId: string): PickRemoval['kind'] => pickRemoval(entries, exerciseId).kind,
    [entries],
  );
  const remove = useCallback((exerciseId: string): boolean => {
    const store = useSessionStore.getState();
    const removal = pickRemoval(store.session?.entries, exerciseId);
    if (removal.kind !== 'removable') return false;
    store.removeExercise(removal.entryIndex, Date.now());
    return true;
  }, []);
  return { removalOf, remove };
}
