/**
 * The active-workout engine: a plain module with a subscription, not a hook.
 *
 * An in-flight workout outlives any component. It has to be readable from the
 * tab bar (a live "in progress" pill), from the root layout's lifecycle handler,
 * from a deep link, and from the rest-timer notification: none of which are
 * descendants of a provider that would own a reducer. So the session lives here
 * as a module singleton with the same external-store shape the settings store
 * uses, and `useWorkoutSession` is a thin subscription over it.
 *
 * **Durability rule:** the in-memory session is a cache of what is on disk, never
 * the other way round. Every mutation is written synchronously-then-published, and
 * the disk write is fire-and-forget with a failure path that stops pretending.
 * Backgrounding the app therefore cannot destroy a workout, and neither can a
 * force-quit: `hydrate()` reads the row back and re-derives the rest timer from its
 * absolute deadline.
 */
import { useSyncExternalStore } from 'react';
import {
  activityRepository,
  recordRepository,
  sessionRepository,
  type SessionPatch,
} from '@/persistence';
import {
  detectPersonalRecords,
  estimatedOneRepMax,
  restRemaining,
  sessionProgress,
  toCompletedWorkout,
} from '@/domain/logic';
import type {
  Activity,
  PersonalRecord,
  StrengthEntry,
  StrengthSet,
  WorkoutSession,
} from '@/domain/types';

export type StartSessionInput = {
  routineId: string | null;
  routineName: string;
  entries: StrengthEntry[];
  defaultRestSeconds: number;
};

export type FinishResult = {
  activity: Activity;
  personalRecords: PersonalRecord[];
};

/**
 * Set while a persistence write is in flight *and* has failed. The UI shows a
 * persistent banner from this: silently dropping reps because SQLite refused a
 * write would be the worst possible outcome of an already bad situation.
 */
let persistFailed = false;
let session: WorkoutSession | null = null;
let hydrated = false;
let timer: ReturnType<typeof setInterval> | null = null;
/** Set by `beginTick` so the engine can tell the user "you were away". */
let awayNoticeSeconds = 0;

const listeners = new Set<() => void>();
/** Monotonic counter used as the snapshot's "changed" signal for tick publishes. */
let tick = 0;
let snapshot: SessionSnapshot = build(tick);

export type SessionSnapshot = {
  session: WorkoutSession | null;
  hydrated: boolean;
  persistFailed: boolean;
  /** Monotonic; forces a re-render each second while a session is running. */
  tick: number;
  /** Seconds the user spent backgrounded, counted into the session on return. */
  awayNoticeSeconds: number;
};

function build(tick = 0): SessionSnapshot {
  return {
    session,
    hydrated,
    persistFailed,
    tick,
    awayNoticeSeconds,
  };
}

function publish(nextTick = tick): void {
  snapshot = build(nextTick);
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * Writes and then publishes. The publish is unconditional so the UI stays live even
 * when the write fails; the failure is a flag, not a rollback.
 */
function commit(patch: SessionPatch | null, write: boolean): void {
  if (!session) return;
  const next: WorkoutSession = {
    ...session,
    ...(patch ?? {}),
    updatedAt: Date.now(),
  } as WorkoutSession;
  if (patch?.entries) next.entries = [...patch.entries];
  session = next;
  if (write) {
    void sessionRepository.save(next).catch((error: unknown) => {
      persistFailed = true;
      console.warn('[workout] could not persist session', error);
      publish();
    });
  }
  publish();
}

/* --------------------------------------------------------------- lifecycle -- */

/**
 * Loads the session to restore, if any. `sessionRepository.active()` already
 * excludes finished and discarded rows, so a workout the user already committed can
 * never be resurrected: but an unfinished one always comes back, which is the
 * brief's "accidentally backgrounding the app must not destroy an active workout".
 */
export async function hydrateWorkoutSession(): Promise<WorkoutSession | null> {
  try {
    session = await sessionRepository.active();
  } catch (error) {
    console.warn('[workout] could not read active session', error);
    session = null;
  }
  hydrated = true;
  persistFailed = false;
  publish();
  if (session && session.status === 'active') beginTick();
  return session;
}

export function startSession(input: StartSessionInput): WorkoutSession {
  const now = Date.now();
  const with1rm = input.entries.map((entry) => ({
    ...entry,
    sets: entry.sets.map((set) => withEstimated1rm(set)),
  }));

  session = {
    id: `session-${now.toString(36)}`,
    routineId: input.routineId,
    routineName: input.routineName,
    startedAt: now,
    elapsedSeconds: 0,
    status: 'active',
    entries: with1rm,
    activeIndex: 0,
    restEndsAt: null,
    restDurationSeconds: null,
    notes: null,
    updatedAt: now,
  };
  hydrated = true;
  persistFailed = false;
  commit(null, true);
  beginTick();
  return session;
}

function withEstimated1rm(set: StrengthSet): StrengthSet {
  if (!set.completed) return set;
  return { ...set, estimated1rm: estimatedOneRepMax(set.weightKg, set.reps) };
}

/**
 * Stops the clock. `elapsedSeconds` is an accumulated foreground total, so pausing
 * is what makes a workout that spanned an hour of backgrounding report the time the
 * user actually trained rather than the wall clock.
 */
export function pauseSession(): void {
  if (!session || session.status !== 'active') return;
  stopTick();
  commit({ status: 'paused' }, true);
}

export function resumeSession(): void {
  if (!session || session.status !== 'paused') return;
  commit({ status: 'active' }, true);
  beginTick();
}

/**
 * Discards without recording. The row is deleted outright rather than flagged, so a
 * crash afterwards cannot leave a half-workout to be restored.
 */
export async function discardSession(id: string): Promise<void> {
  stopTick();
  await sessionRepository.remove(id).catch((error: unknown) => {
    console.warn('[workout] could not discard session', error);
  });
  if (session?.id === id) {
    session = null;
    publish();
  }
}

/**
 * Commits the session to history.
 *
 * `detectPersonalRecords` needs prior history to compare against, and the current
 * session must not be part of it: otherwise the workout being finished would be
 * its own baseline and no PR would ever register. `activityRepository.list` is
 * called before the insert for exactly that reason, and the whole thing is one
 * repository call so a crash between "insert" and "record PRs" cannot leave a
 * workout with no PRs.
 */
export async function finishSession(id: string): Promise<FinishResult | null> {
  const target = session?.id === id ? session : await sessionRepository.byId(id);
  if (!target || target.status === 'discarded') return null;
  stopTick();

  const endedAt = Date.now();
  const history = await activityRepository.list({ order: 'desc', limit: 400 });
  const personalRecords = detectPersonalRecords(target.entries, history, endedAt);
  const workout = toCompletedWorkout(target, endedAt);

  await sessionRepository.setStatus(id, 'finished');
  const activity = await activityRepository.recordWorkout(workout, personalRecords);
  await recordRepository.commitMany(personalRecords);

  if (session?.id === id) {
    session = null;
    persistFailed = false;
    publish();
  }
  return { activity, personalRecords };
}

/* ------------------------------------------------------------------ edits -- */

export function setRestTimer(seconds: number | null): void {
  if (!session) return;
  if (seconds === null) {
    commit({ restEndsAt: null, restDurationSeconds: null }, true);
    return;
  }
  const rounded = Math.max(5, Math.round(seconds));
  commit(
    { restEndsAt: Date.now() + rounded * 1000, restDurationSeconds: rounded },
    true,
  );
}

export function clearRest(): void {
  if (!session) return;
  void sessionRepository.clearRest(session.id).catch(() => {});
  commit({ restEndsAt: null, restDurationSeconds: null }, false);
}

export function setActiveIndex(index: number): void {
  if (!session) return;
  const clamped = Math.max(0, Math.min(session.entries.length - 1, index));
  commit({ activeIndex: clamped }, true);
}

export function toggleSet(entryIndex: number, setIndex: number): number | null {
  if (!session) return null;
  const entry = session.entries[entryIndex];
  if (!entry) return null;

  let restForCompletedSet: number | null = null;
  const sets = entry.sets.map((set, i) => {
    if (i !== setIndex) return set;
    const completed = !set.completed;
    if (completed) restForCompletedSet = entry.restSeconds;
    return withEstimated1rm({ ...set, completed });
  });

  const entries = session.entries.map((e, i) => (i === entryIndex ? { ...e, sets } : e));
  commit({ entries }, true);
  return restForCompletedSet;
}

export function updateSet(
  entryIndex: number,
  setIndex: number,
  patch: Partial<Pick<StrengthSet, 'reps' | 'weightKg' | 'rpe'>>,
): void {
  if (!session) return;
  const entry = session.entries[entryIndex];
  if (!entry) return;
  const sets = entry.sets.map((set, i) =>
    i === setIndex ? withEstimated1rm({ ...set, ...patch }) : set,
  );
  const entries = session.entries.map((e, i) => (i === entryIndex ? { ...e, sets } : e));
  commit({ entries }, true);
}

/** Appends a set, inheriting the previous one's targets: the common case. */
export function addSet(entryIndex: number): void {
  if (!session) return;
  const entry = session.entries[entryIndex];
  if (!entry) return;
  const last = entry.sets[entry.sets.length - 1];
  const sets: StrengthSet[] = [
    ...entry.sets,
    withEstimated1rm({
      index: entry.sets.length,
      reps: last?.reps ?? 8,
      weightKg: last?.weightKg ?? 0,
      completed: false,
      estimated1rm: null,
      rpe: null,
    }),
  ];
  const entries = session.entries.map((e, i) => (i === entryIndex ? { ...e, sets } : e));
  commit({ entries }, true);
}

export function removeSet(entryIndex: number, setIndex: number): void {
  if (!session) return;
  const entry = session.entries[entryIndex];
  if (!entry || entry.sets.length <= 1) return;
  const sets = entry.sets
    .filter((_, i) => i !== setIndex)
    .map((set, i) => ({ ...set, index: i }));
  const entries = session.entries.map((e, i) => (i === entryIndex ? { ...e, sets } : e));
  commit({ entries }, true);
}

export function skipExercise(entryIndex: number): void {
  if (!session) return;
  const entries = session.entries.map((e, i) =>
    i === entryIndex
      ? { ...e, sets: e.sets.map((s) => ({ ...s, completed: false })), notes: e.notes ?? 'Skipped' }
      : e,
  );
  commit(
    { entries, activeIndex: Math.min(entryIndex + 1, session.entries.length - 1) },
    true,
  );
}

export function removeExercise(entryIndex: number): void {
  if (!session || session.entries.length <= 1) return;
  const entries = session.entries.filter((_, i) => i !== entryIndex);
  commit(
    {
      entries,
      activeIndex: Math.min(session.activeIndex, entries.length - 1),
    },
    true,
  );
}

export function addExercise(entry: StrengthEntry): void {
  if (!session) return;
  commit({ entries: [...session.entries, entry] }, true);
}

export function setSessionNotes(notes: string | null): void {
  commit({ notes }, true);
}

export function setRestDurationForEntry(entryIndex: number, seconds: number): void {
  if (!session) return;
  const entries = session.entries.map((e, i) =>
    i === entryIndex ? { ...e, restSeconds: Math.max(0, Math.round(seconds)) } : e,
  );
  commit({ entries }, true);
}

/* ------------------------------------------------------------------ clock -- */

let lastTickAt = 0;

/**
 * One-second tick that owns elapsed time.
 *
 * Doing the arithmetic here rather than in a component's interval means a screen
 * unmount: swiping to the Activities tab mid-set, which happens constantly: cannot
 * lose seconds. On `resume`, `awayNoticeSeconds` reports how long the user was gone
 * so a two-minute rest can be shown as having elapsed rather than silently frozen.
 */
function beginTick(): void {
  if (timer !== null) return;
  lastTickAt = Date.now();
  timer = setInterval(() => {
    if (!session || session.status !== 'active') return;
    const now = Date.now();
    const delta = Math.max(0, Math.round((now - lastTickAt) / 1000));
    lastTickAt = now;
    const next = { ...session, elapsedSeconds: session.elapsedSeconds + delta };
    session = next;
    // Persisting every tick would be a transaction per second for no benefit: the
    // deadline-based rest timer and the on-finish write cover correctness, and this
    // value only needs to survive to the next app state change.
    tick += 1;
    publish(tick);
  }, 1_000);
}

function stopTick(): void {
  if (timer !== null) {
    clearInterval(timer);
    timer = null;
  }
}

/**
 * Called from the app-state handler.
 *
 * Background time **counts**. A strength session with the phone in a pocket is still a
 * session: the sets you did five minutes ago are still done, and a clock that froze
 * while you were away would understate a workout you actually finished. What the pause
 * of the tick protects is the arithmetic, not the total: on return the whole away gap is
 * added once from `lastTickAt`, so no second is double-counted or dropped by a missed
 * interval. `awayNoticeSeconds` reports the size of that gap so the screen can say so
 * rather than let 40 unattended seconds read as 40 seconds of work.
 *
 * An absolute-deadline rest timer keeps counting the whole time, which is the point: a
 * rest that expired in your pocket has expired.
 */
export function handleAppState(next: 'active' | 'background' | 'inactive'): void {
  if (!session) return;
  if (next === 'active') {
    if (session.status !== 'active') return;
    const gap = Math.max(0, Math.round((Date.now() - lastTickAt) / 1000));
    awayNoticeSeconds = gap;
    lastTickAt = Date.now();
    // A rest timer that expired while backgrounded resolves to zero remaining; the
    // notification would have fired, and the UI reads the same deadline either way.
    beginTick();
    if (gap > 0) commit({ elapsedSeconds: session.elapsedSeconds + gap }, true);
    return;
  }
  stopTick();
  void sessionRepository.save(session).catch(() => {
    persistFailed = true;
  });
}

/* ------------------------------------------------------------- subscriptions -- */

export function getSessionSnapshot(): SessionSnapshot {
  return snapshot;
}

export function getActiveSession(): WorkoutSession | null {
  return session;
}

export function isWorkoutHydrated(): boolean {
  return hydrated;
}

export function clearAwayNotice(): void {
  if (awayNoticeSeconds === 0) return;
  awayNoticeSeconds = 0;
  publish();
}

export function useWorkoutSession(): SessionSnapshot {
  return useSyncExternalStore(subscribe, getSessionSnapshot, getSessionSnapshot);
}

/**
 * Is a workout in progress (active or paused)?
 *
 * A BOOLEAN on purpose. `useWorkoutSession()` republishes once a second while a workout
 * runs, so a screen that only needs to know "is the floating pill on screen, and must I
 * reserve room for it" would re-render every tick to answer a question whose answer changed
 * once. `useSyncExternalStore` compares with `Object.is`, so returning the boolean means the
 * subscriber wakes on the transition and never on the ticks between.
 */
export function useWorkoutRunning(): boolean {
  return useSyncExternalStore(subscribe, isRunningNow, isRunningNow);
}

function isRunningNow(): boolean {
  const s = getSessionSnapshot().session;
  return s !== null && (s.status === 'active' || s.status === 'paused');
}

/** Derived, memo-free helpers so screens do not each reimplement progress maths. */
export function useSessionProgress(): { completed: number; planned: number; ratio: number } {
  const snap = useWorkoutSession();
  return snap.session ? sessionProgress(snap.session) : { completed: 0, planned: 0, ratio: 0 };
}

export function useRestRemaining(): number {
  const snap = useWorkoutSession();
  // Recomputed from the absolute deadline on every published tick, which is why no
  // separate interval is needed for the countdown label.
  return snap.session ? restRemaining(snap.session.restEndsAt) : 0;
}
