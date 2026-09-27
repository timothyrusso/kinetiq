import { useCallback } from 'react';
import type { SetPatch } from '@/features/workouts/domain/utils/sessionTransitions';
import { useSessionStore } from '@/features/workouts/state/sessionStore';

/**
 * One set of the workout in progress, read from the session on every render rather than held:
 * the session writes through on each stepper press, and a copy would freeze the editor at the
 * moment it opened while the row behind it moved.
 */
export function useSetEditor(entryIndex: number, setIndex: number) {
  const session = useSessionStore.use.session();
  const entry = session?.entries[entryIndex];
  const set = entry?.sets[setIndex];
  const change = useCallback(
    (patch: SetPatch) => useSessionStore.getState().updateSet(entryIndex, setIndex, patch, Date.now()),
    [entryIndex, setIndex],
  );
  const remove = useCallback(
    () => useSessionStore.getState().removeSet(entryIndex, setIndex, Date.now()),
    [entryIndex, setIndex],
  );
  return { entry, set, change, remove };
}
