import type {
  EntryFields,
  StrengthEntry,
  StrengthSet,
  TrackingType,
} from '@/features/workouts/domain/schemas/StrengthEntrySchema';
import type { WorkoutSession } from '@/features/workouts/domain/schemas/WorkoutSessionSchema';
import { withEstimated1rm } from '@/features/workouts/domain/utils/oneRepMax';
import { entryAs, isTypeLocked, newSet, withSets } from '@/features/workouts/domain/utils/trackingSets';

/**
 * The fields a set editor may change. A field the set's type does not record is ignored: a weight
 * sent to a reps-only set changes nothing.
 */
export interface SetPatch {
  readonly reps?: number;
  readonly weightKg?: number;
  readonly durationSeconds?: number;
  readonly rpe?: number | null;
}

/** The fields of an exercise the exercise editor may change besides its sets. */
export type EntryPatch = Partial<Pick<EntryFields, 'restSeconds' | 'notes'>>;

/** The shortest rest a timer can hold; less than this is no rest, which is `clearRest`. */
const MIN_REST_SECONDS = 5;

/** `set` with the fields of `patch` its type records, its estimate refreshed. */
function patched(set: StrengthSet, patch: SetPatch): StrengthSet {
  const rpe = patch.rpe === undefined ? set.rpe : patch.rpe;
  switch (set.type) {
    case 'weightReps':
      return withEstimated1rm({
        ...set,
        rpe,
        reps: patch.reps ?? set.reps,
        weightKg: patch.weightKg ?? set.weightKg,
      });
    case 'repsOnly':
      return { ...set, rpe, reps: patch.reps ?? set.reps };
    case 'duration':
      return { ...set, rpe, durationSeconds: patch.durationSeconds ?? set.durationSeconds };
  }
}

/** `set` ticked or unticked, its estimate refreshed. */
function withCompleted(set: StrengthSet, completed: boolean): StrengthSet {
  return set.type === 'weightReps' ? withEstimated1rm({ ...set, completed }) : { ...set, completed };
}

/**
 * The next session, stamped `updatedAt: now`. Every transition below goes through it, or returns
 * the same object when the change does not apply, so the caller can tell "nothing to write" by
 * identity.
 */
function touch(session: WorkoutSession, patch: Partial<WorkoutSession>, now: number): WorkoutSession {
  return { ...session, ...patch, updatedAt: now };
}

function withEntrySets(
  session: WorkoutSession,
  entryIndex: number,
  sets: readonly StrengthSet[],
  now: number,
): WorkoutSession {
  const entries = session.entries.map((entry, index) => (index === entryIndex ? withSets(entry, sets) : entry));
  return touch(session, { entries }, now);
}

/** Stops the clock: `elapsedSeconds` counts training time, so a paused hour is not banked. */
export function pauseSession(session: WorkoutSession, now: number): WorkoutSession {
  return session.status === 'active' ? touch(session, { status: 'paused' }, now) : session;
}

export function resumeSession(session: WorkoutSession, now: number): WorkoutSession {
  return session.status === 'paused' ? touch(session, { status: 'active' }, now) : session;
}

/**
 * Starts a rest of `seconds` from `now`, as an absolute deadline, or clears it with `null`. A rest
 * is at least five seconds, rounded to the second.
 */
export function startRest(session: WorkoutSession, seconds: number | null, now: number): WorkoutSession {
  if (seconds === null) return clearRest(session, now);
  const rounded = Math.max(MIN_REST_SECONDS, Math.round(seconds));
  return touch(session, { restEndsAt: now + rounded * 1000, restDurationSeconds: rounded }, now);
}

export function clearRest(session: WorkoutSession, now: number): WorkoutSession {
  return touch(session, { restEndsAt: null, restDurationSeconds: null }, now);
}

/** Makes `index` the current exercise, clamped into the list. */
export function focusExercise(session: WorkoutSession, index: number, now: number): WorkoutSession {
  const clamped = Math.max(0, Math.min(session.entries.length - 1, index));
  return touch(session, { activeIndex: clamped }, now);
}

/**
 * Ticks or unticks a set. `restSeconds` is the entry's rest when the set was just completed, and
 * `null` when it was unticked or there is no such entry: the caller starts a rest only on a tick.
 */
export function toggleSet(
  session: WorkoutSession,
  entryIndex: number,
  setIndex: number,
  now: number,
): { readonly session: WorkoutSession; readonly restSeconds: number | null } {
  const entry = session.entries[entryIndex];
  if (!entry) return { session, restSeconds: null };
  let restSeconds: number | null = null;
  const sets = entry.sets.map((set, index) => {
    if (index !== setIndex) return set;
    const completed = !set.completed;
    if (completed) restSeconds = entry.restSeconds;
    return withCompleted(set, completed);
  });
  return { session: withEntrySets(session, entryIndex, sets, now), restSeconds };
}

export function updateSet(
  session: WorkoutSession,
  entryIndex: number,
  setIndex: number,
  patch: SetPatch,
  now: number,
): WorkoutSession {
  const entry = session.entries[entryIndex];
  if (!entry) return session;
  const sets = entry.sets.map((set, index) => (index === setIndex ? patched(set, patch) : set));
  return withEntrySets(session, entryIndex, sets, now);
}

/**
 * Changes the exercise's rest or note. The rest is the one the next ticked set starts: a rest
 * already running keeps its deadline, which is the session's, not the entry's.
 */
export function updateEntry(
  session: WorkoutSession,
  entryIndex: number,
  patch: EntryPatch,
  now: number,
): WorkoutSession {
  const entry = session.entries[entryIndex];
  if (!entry) return session;
  const entries = session.entries.map((row, index) => (index === entryIndex ? { ...row, ...patch } : row));
  return touch(session, { entries }, now);
}

/** An open copy of `last` at `index`: its targets, with no RPE and no routine row. */
function copiedSet(last: StrengthSet, index: number): StrengthSet {
  const base = { index, completed: false, rpe: null };
  switch (last.type) {
    case 'weightReps':
      return { ...base, type: last.type, reps: last.reps, weightKg: last.weightKg, estimated1rm: null };
    case 'repsOnly':
      return { ...base, type: last.type, reps: last.reps };
    case 'duration':
      return { ...base, type: last.type, durationSeconds: last.durationSeconds };
  }
}

/**
 * Appends a set with the previous set's targets: the common case. An exercise with no sets gets
 * one on its type's defaults.
 */
export function addSet(session: WorkoutSession, entryIndex: number, now: number): WorkoutSession {
  const entry = session.entries[entryIndex];
  if (!entry) return session;
  const index = entry.sets.length;
  const last = entry.sets[index - 1];
  const added = last === undefined ? newSet(entry.trackingType, index) : copiedSet(last, index);
  return withEntrySets(session, entryIndex, [...entry.sets, added], now);
}

/**
 * Changes what the exercise records. Allowed until one of its sets is completed; after that the
 * type is locked and the same session comes back. Each set is carried over by `setAs`.
 */
export function changeTrackingType(
  session: WorkoutSession,
  entryIndex: number,
  type: TrackingType,
  now: number,
): WorkoutSession {
  const entry = session.entries[entryIndex];
  if (!entry || entry.trackingType === type || isTypeLocked(entry)) return session;
  const entries = session.entries.map((row, index) => (index === entryIndex ? entryAs(row, type) : row));
  return touch(session, { entries }, now);
}

/** Removes a set and numbers the rest from 0 again. An exercise keeps its last set. */
export function removeSet(session: WorkoutSession, entryIndex: number, setIndex: number, now: number): WorkoutSession {
  const entry = session.entries[entryIndex];
  if (!entry || entry.sets.length <= 1) return session;
  const sets = entry.sets.filter((_, index) => index !== setIndex).map((set, index) => ({ ...set, index }));
  return withEntrySets(session, entryIndex, sets, now);
}

/**
 * Unticks every set of the exercise and moves on to the next one. The cue is left alone: skipped
 * is read from the sets, which is what the workout detail's badge does.
 */
export function skipExercise(session: WorkoutSession, entryIndex: number, now: number): WorkoutSession {
  const entries = session.entries.map((entry, index) =>
    index === entryIndex
      ? withSets(
          entry,
          entry.sets.map(set => withCompleted(set, false)),
        )
      : entry,
  );
  return touch(session, { entries, activeIndex: Math.min(entryIndex + 1, session.entries.length - 1) }, now);
}

/**
 * Removes an exercise and the sets banked against it. The current exercise stays current as the
 * list closes up over one removed above it. The last exercise goes too: a session with none is the
 * one an empty workout starts as, and with nothing left to rest for, its rest ends.
 */
export function removeExercise(session: WorkoutSession, entryIndex: number, now: number): WorkoutSession {
  if (session.entries[entryIndex] === undefined) return session;
  const entries = session.entries.filter((_, index) => index !== entryIndex);
  const current = entryIndex < session.activeIndex ? session.activeIndex - 1 : session.activeIndex;
  const activeIndex = Math.max(0, Math.min(current, entries.length - 1));
  const rest = entries.length === 0 ? { restEndsAt: null, restDurationSeconds: null } : {};
  return touch(session, { entries, activeIndex, ...rest }, now);
}

export function addExercise(session: WorkoutSession, entry: StrengthEntry, now: number): WorkoutSession {
  return touch(session, { entries: [...session.entries, entry] }, now);
}

/** Banks `seconds` of training time, stamped: the return from a background, which is written. */
export function bankElapsed(session: WorkoutSession, seconds: number, now: number): WorkoutSession {
  return touch(session, { elapsedSeconds: session.elapsedSeconds + seconds }, now);
}

/** Banks `seconds` from a clock tick. Not stamped: a tick is not a change the user made. */
export function tickElapsed(session: WorkoutSession, seconds: number): WorkoutSession {
  return { ...session, elapsedSeconds: session.elapsedSeconds + seconds };
}

/**
 * Whole seconds between two readings of the wall clock. The clock banks this on every tick and
 * on a return to the foreground, so no second is counted twice or dropped by a missed tick.
 */
export function secondsBetween(from: number, to: number): number {
  return Math.max(0, Math.round((to - from) / 1000));
}
