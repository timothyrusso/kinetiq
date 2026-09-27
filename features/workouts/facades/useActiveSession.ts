import type { AppLifecycle } from '@/features/workouts/domain/entities/AppLifecycle';
import type { StrengthEntry } from '@/features/workouts/domain/schemas/StrengthEntrySchema';
import type { WorkoutSession } from '@/features/workouts/domain/schemas/WorkoutSessionSchema';
import { isInProgress } from '@/features/workouts/domain/utils/sessionStatus';
import type { SetPatch } from '@/features/workouts/domain/utils/sessionTransitions';
import { useSessionStore } from '@/features/workouts/state/sessionStore';

const store = () => useSessionStore.getState();

/**
 * The changes a screen makes to the workout in progress, stamped with the time they happen. Each
 * is published at once and written behind it; none has a pending state. Module-level, so every
 * one is stable and a memoised row can take it as a prop.
 */
export const sessionActions = {
  pause: () => store().pause(Date.now()),
  resume: () => store().resume(Date.now()),
  setRest: (seconds: number | null) => store().setRest(seconds, Date.now()),
  clearRest: () => store().clearRest(Date.now()),
  focus: (entryIndex: number) => store().focus(entryIndex, Date.now()),
  // NOTE: returns the rest to start when the set was just completed, else `null`.
  toggleSet: (entryIndex: number, setIndex: number) => store().toggleSet(entryIndex, setIndex, Date.now()),
  updateSet: (entryIndex: number, setIndex: number, patch: SetPatch) =>
    store().updateSet(entryIndex, setIndex, patch, Date.now()),
  addSet: (entryIndex: number) => store().addSet(entryIndex, Date.now()),
  removeSet: (entryIndex: number, setIndex: number) => store().removeSet(entryIndex, setIndex, Date.now()),
  skipExercise: (entryIndex: number) => store().skipExercise(entryIndex, Date.now()),
  removeExercise: (entryIndex: number) => store().removeExercise(entryIndex, Date.now()),
  addExercise: (entry: StrengthEntry) => store().addExercise(entry, Date.now()),
} as const;

/**
 * The workout in progress and what the screen needs around it. The session republishes every
 * second while it runs, so only the screens that show the clock should read it: a screen that
 * needs "is one running" reads `useWorkoutRunning`.
 */
export function useActiveSession() {
  return {
    session: useSessionStore.use.session(),
    hydrated: useSessionStore.use.hydrated(),
    persistFailed: useSessionStore.use.persistFailed(),
    awayNoticeSeconds: useSessionStore.use.awayNoticeSeconds(),
  };
}

/**
 * Whether a workout is in progress, active or paused. A boolean, so its subscriber wakes on the
 * transition and never on the ticks between.
 */
export function useWorkoutRunning(): boolean {
  return useSessionStore(state => isInProgress(state.session));
}

/** The name of the workout in progress, or `null`: a string, so the ticks between wake nothing. */
export function useRunningWorkoutName(): string | null {
  return useSessionStore(state => (isInProgress(state.session) ? state.session.routineName : null));
}

/**
 * The launch's calls into the session: take the restored session, pause it, and follow the app
 * in and out of the foreground. Outside React: the app-state handler is not a component.
 */
export const sessionLifecycle = {
  restore: (session: WorkoutSession | null) => store().hydrate(session, Date.now()),
  pause: () => store().pause(Date.now()),
  appStateChanged: (next: AppLifecycle) => store().appStateChanged(next, Date.now()),
} as const;
