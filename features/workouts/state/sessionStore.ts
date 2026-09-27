import { createSelectors, createStore, setSessionInProgress } from '@/features/core/state';
import type { AppLifecycle } from '@/features/workouts/domain/entities/AppLifecycle';
import type { SessionWrite } from '@/features/workouts/domain/entities/SessionWrite';
import type { StrengthEntry } from '@/features/workouts/domain/schemas/StrengthEntrySchema';
import type { WorkoutSession } from '@/features/workouts/domain/schemas/WorkoutSessionSchema';
import { isInProgress } from '@/features/workouts/domain/utils/sessionStatus';
import {
  addExercise,
  addSet,
  bankElapsed,
  clearRest,
  focusExercise,
  pauseSession,
  removeExercise,
  removeSet,
  resumeSession,
  type SetPatch,
  secondsBetween,
  skipExercise,
  startRest,
  tickElapsed,
  toggleSet,
  updateSet,
} from '@/features/workouts/domain/utils/sessionTransitions';

interface SessionStoreState {
  /** The workout in progress. A cache of what is on disk, never the other way round. */
  readonly session: WorkoutSession | null;
  /** The launch has read back the session to restore, if there was one. */
  readonly hydrated: boolean;
  /** A write of the session failed: the screen says it is not being saved. */
  readonly persistFailed: boolean;
  /** Counts the clock's ticks, so a screen showing the elapsed time re-renders each second. */
  readonly tick: number;
  /** How long the app was just away, counted into the session on return. */
  readonly awayNoticeSeconds: number;
  /** The session clock is counting. */
  readonly clockRunning: boolean;
  /** When the clock last banked time, unix ms. */
  readonly lastTickAt: number;
  /** Counts the writes the session needs; the persistence writes `pendingWrite` when it moves. */
  readonly writes: number;
  readonly pendingWrite: SessionWrite | null;

  readonly hydrate: (session: WorkoutSession | null, now: number) => void;
  readonly start: (session: WorkoutSession, now: number) => void;
  readonly pause: (now: number) => void;
  readonly resume: (now: number) => void;
  readonly setRest: (seconds: number | null, now: number) => void;
  readonly clearRest: (now: number) => void;
  readonly focus: (entryIndex: number, now: number) => void;
  /** Returns the rest to start: the entry's, when the set was just completed, else `null`. */
  readonly toggleSet: (entryIndex: number, setIndex: number, now: number) => number | null;
  readonly updateSet: (entryIndex: number, setIndex: number, patch: SetPatch, now: number) => void;
  readonly addSet: (entryIndex: number, now: number) => void;
  readonly removeSet: (entryIndex: number, setIndex: number, now: number) => void;
  readonly skipExercise: (entryIndex: number, now: number) => void;
  readonly removeExercise: (entryIndex: number, now: number) => void;
  readonly addExercise: (entry: StrengthEntry, now: number) => void;
  readonly tickClock: (now: number) => void;
  readonly appStateChanged: (next: AppLifecycle, now: number) => void;
  /** Stops the clock while the session is being recorded. */
  readonly beginFinish: () => void;
  /** Session `id` was recorded or discarded: nothing is in progress any more. */
  readonly ended: (id: string) => void;
  readonly markPersistFailed: () => void;
}

type State = SessionStoreState;

/** The state after `session` replaced the current one and is queued for a full write. */
function saved(state: State, session: WorkoutSession): Partial<State> {
  return { session, writes: state.writes + 1, pendingWrite: { kind: 'save', session } };
}

/**
 * The state after `next`, when a transition produced a new session: queued for a write. The same
 * object means the change did not apply, and nothing is written.
 */
function applied(state: State, next: WorkoutSession): Partial<State> {
  return state.session === next ? {} : saved(state, next);
}

/** The clock starts counting from now, unless it already is. */
function clockOn(state: State, now: number): Partial<State> {
  return state.clockRunning ? {} : { clockRunning: true, lastTickAt: now };
}

/**
 * The workout in progress, as a store: it has to be readable from the tab bar's pill, the launch,
 * the app-state handler and the pickers, none of which share a provider.
 *
 * Every change goes through a transition in `domain/utils/sessionTransitions` and is published
 * at once; the ones that change the session also queue a write, which `SessionEngineLive` makes.
 * A failed write is a flag, not a rollback: the UI stays live and says it is not saving. The
 * clock is a flag here and a fiber there, so a screen unmount cannot lose a second.
 */
const sessionStore = createStore<SessionStoreState>((set, get) => {
  const transition = (change: (session: WorkoutSession) => WorkoutSession) =>
    set(state => (state.session === null ? {} : applied(state, change(state.session))));

  return {
    session: null,
    hydrated: false,
    persistFailed: false,
    tick: 0,
    awayNoticeSeconds: 0,
    clockRunning: false,
    lastTickAt: 0,
    writes: 0,
    pendingWrite: null,

    hydrate: (session, now) =>
      set(state => ({
        session,
        hydrated: true,
        persistFailed: false,
        ...(session?.status === 'active' ? clockOn(state, now) : {}),
      })),

    start: (session, now) =>
      set(state => ({ ...saved(state, session), hydrated: true, persistFailed: false, ...clockOn(state, now) })),

    pause: now =>
      set(state => {
        if (state.session === null || state.session.status !== 'active') return {};
        return { ...saved(state, pauseSession(state.session, now)), clockRunning: false };
      }),

    resume: now =>
      set(state => {
        if (state.session === null || state.session.status !== 'paused') return {};
        return { ...saved(state, resumeSession(state.session, now)), ...clockOn(state, now) };
      }),

    setRest: (seconds, now) => transition(session => startRest(session, seconds, now)),

    clearRest: now =>
      set(state => {
        if (state.session === null) return {};
        return {
          session: clearRest(state.session, now),
          writes: state.writes + 1,
          pendingWrite: { kind: 'clearRest', sessionId: state.session.id },
        };
      }),

    focus: (entryIndex, now) => transition(session => focusExercise(session, entryIndex, now)),

    toggleSet: (entryIndex, setIndex, now) => {
      const current = get().session;
      if (current === null) return null;
      const { session, restSeconds } = toggleSet(current, entryIndex, setIndex, now);
      set(state => applied(state, session));
      return restSeconds;
    },

    updateSet: (entryIndex, setIndex, patch, now) =>
      transition(session => updateSet(session, entryIndex, setIndex, patch, now)),

    addSet: (entryIndex, now) => transition(session => addSet(session, entryIndex, now)),

    removeSet: (entryIndex, setIndex, now) => transition(session => removeSet(session, entryIndex, setIndex, now)),

    skipExercise: (entryIndex, now) => transition(session => skipExercise(session, entryIndex, now)),

    removeExercise: (entryIndex, now) => transition(session => removeExercise(session, entryIndex, now)),

    addExercise: (entry, now) => transition(session => addExercise(session, entry, now)),

    // NOTE: a tick is not written: a transaction a second buys nothing, the rest is a deadline,
    // and the elapsed time is written with the next change and whenever the app leaves the front.
    tickClock: now =>
      set(state => {
        if (state.session === null || state.session.status !== 'active' || !state.clockRunning) return {};
        return {
          session: tickElapsed(state.session, secondsBetween(state.lastTickAt, now)),
          lastTickAt: now,
          tick: state.tick + 1,
        };
      }),

    // NOTE: background time counts: the sets done before the phone went into a pocket are still
    // done. The clock stops while the app is away and the whole gap is banked once on return, so
    // no second is counted twice or dropped, and `awayNoticeSeconds` lets the screen say so.
    appStateChanged: (next, now) =>
      set(state => {
        const { session } = state;
        if (session === null) return {};
        if (next !== 'active') {
          return {
            clockRunning: false,
            writes: state.writes + 1,
            pendingWrite: { kind: 'save', session },
          };
        }
        if (session.status !== 'active') return {};
        const gap = secondsBetween(state.lastTickAt, now);
        return {
          ...(gap > 0 ? saved(state, bankElapsed(session, gap, now)) : {}),
          awayNoticeSeconds: gap,
          clockRunning: true,
          lastTickAt: now,
        };
      }),

    beginFinish: () => set({ clockRunning: false }),

    ended: id =>
      set(state => (state.session?.id === id ? { session: null, persistFailed: false, clockRunning: false } : {})),

    markPersistFailed: () => set({ persistFailed: true }),
  };
});

// NOTE: the core's copy of "a workout is in progress", which the tab screens and the reminder
// scheduler read without depending on this feature. Subscribed at creation, so it is current
// before any component's listener runs.
sessionStore.subscribe(({ session }, previous) => {
  if (session === previous.session) return;
  setSessionInProgress(isInProgress(session));
});

/** The session store, with a selector hook per key. */
export const useSessionStore = createSelectors(sessionStore);
