import { useCallback } from 'react';
import type { EntryPatch, SetPatch } from '@/features/workouts/domain/utils/sessionTransitions';
import { useSessionStore } from '@/features/workouts/state/sessionStore';

/**
 * One exercise of the workout in progress, read from the session on every render rather than
 * held: the session writes through on each stepper press, and a copy would freeze the editor at
 * the moment it opened while the block behind it moved. Every writer goes through the session's
 * transitions, so a set edit refreshes its estimate and keeps the routine row it was planned
 * from, and the exercise keeps its last set.
 */
export function useExerciseEditor(entryIndex: number) {
  const entry = useSessionStore(state => state.session?.entries[entryIndex]);
  const changeSet = useCallback(
    (setIndex: number, patch: SetPatch) =>
      useSessionStore.getState().updateSet(entryIndex, setIndex, patch, Date.now()),
    [entryIndex],
  );
  const addSet = useCallback(() => useSessionStore.getState().addSet(entryIndex, Date.now()), [entryIndex]);
  const removeSet = useCallback(
    (setIndex: number) => useSessionStore.getState().removeSet(entryIndex, setIndex, Date.now()),
    [entryIndex],
  );
  const changeEntry = useCallback(
    (patch: EntryPatch) => useSessionStore.getState().updateEntry(entryIndex, patch, Date.now()),
    [entryIndex],
  );
  return { entry, changeSet, addSet, removeSet, changeEntry };
}
