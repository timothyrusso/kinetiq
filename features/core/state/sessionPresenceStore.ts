import { createSelectors } from '@/features/core/state/createSelectors';
import { createStore } from '@/features/core/state/createStore';

interface SessionPresenceState {
  /** A live session (a workout, active or paused) is in progress. */
  readonly inProgress: boolean;
  readonly setInProgress: (inProgress: boolean) => void;
}

/**
 * Whether a live session is in progress, for the code below the feature that owns the session:
 * the tab screens reserve room for the floating session pill, and the reminder scheduler leaves
 * the schedule alone while a rest alert may be pending. The owner writes it; nothing else does.
 */
const sessionPresenceStore = createStore<SessionPresenceState>(set => ({
  inProgress: false,
  setInProgress: inProgress => set({ inProgress }),
}));

const useSessionPresenceStore = createSelectors(sessionPresenceStore);

/** Re-renders on the transition only, never on the session's per-second tick. */
export function useSessionInProgress(): boolean {
  return useSessionPresenceStore.use.inProgress();
}

/** The answer now, for a handler. */
export function isSessionInProgress(): boolean {
  return sessionPresenceStore.getState().inProgress;
}

/** Called by the feature that owns the session, whenever it starts or ends one. */
export function setSessionInProgress(inProgress: boolean): void {
  sessionPresenceStore.getState().setInProgress(inProgress);
}
