/**
 * Domain rules that the UI must never re-implement: energy expenditure,
 * estimated one-rep max, streaks and derived totals.
 */
import {
  Activity,
  RoutineItem,
  CompletedWorkout,
  PersonalRecord,
  StrengthEntry,
  StrengthSet,
  Streak,
  WorkoutSession,
} from './types';
import { daysBetween, repsFromRange, startOfDay } from '@/utils/format';
import { sum } from '@/utils/functional';

/**
 * MET-based calorie model for resistance training, scaled for a 74 kg reference athlete.
 * Deliberately simple and monotonic: a fitness app's calorie number is an estimate the user
 * trends against, not a measurement.
 */
const LIFT_MET = 5.0;

export function estimateCalories(durationSeconds: number): number {
  const hours = Math.max(0, durationSeconds) / 3600;
  return Math.round(LIFT_MET * 74 * hours);
}

/** Epley. Conservative above ~10 reps, which is where linear models diverge. */
export function estimatedOneRepMax(weightKg: number, reps: number): number | null {
  if (weightKg <= 0 || reps <= 0) return null;
  if (reps === 1) return roundKg(weightKg);
  if (reps > 15) return null;
  return roundKg(weightKg * (1 + reps / 30));
}

function roundKg(value: number): number {
  return Math.round(value * 2) / 2;
}

export function setVolumeKg(set: Pick<StrengthSet, 'reps' | 'weightKg'>): number {
  return Math.max(0, set.reps) * Math.max(0, set.weightKg);
}

export function entryVolumeKg(entry: Pick<StrengthEntry, 'sets'>): number {
  return sum(entry.sets.filter((s) => s.completed).map(setVolumeKg));
}

export function totalVolumeKg(entries: readonly StrengthEntry[]): number {
  return Math.round(sum(entries.map(entryVolumeKg)));
}

/**
 * Planned load for a *program*: Σ sets × weight, over a routine's rows.
 *
 * The sibling of `totalVolumeKg`, which is the same sum over sets actually performed. The
 * two must stay side by side in this file because their whole value is being comparable, * a progress screen that computes the planned figure with a different rule than the performed
 * one shows a "completion percentage" that means nothing.
 *
 * Bodyweight rows contribute zero, which is correct for load and not a bug: tonnage is the
 * unit here, and a routine of bodyweight work legitimately has a planned volume of 0.
 */
export function plannedVolumeKg(items: readonly RoutineItem[]): number {
  return items.reduce((total, item) => total + item.sets * Math.max(0, item.weightKg), 0);
}

/** Total programmed reps, each row's rep target read by `repsFromRange`. */
export function plannedReps(items: readonly RoutineItem[]): number {
  return items.reduce((total, item) => total + item.sets * repsFromRange(item.reps), 0);
}

/**
 * The "about 55 min" figure on a routine header.
 *
 * Deliberately rough and labelled as such wherever it is shown: a rep is three seconds of
 * work, rest is whatever the row says, and every exercise costs twenty seconds of
 * transition. Anyone who has timed a real session knows the number is an estimate, which is
 * why it carries the word rather than pretending to a precision this model does not have.
 *
 * It is a duration model rather than a domain rule in the sense the rest of this file means,
 * but it belongs here for the same reason the volume figures do: the builder and the saved
 * routine screen both show it, and two copies drift into disagreeing about how long the same
 * routine takes.
 */
export function estimateMinutes(items: readonly RoutineItem[]): number {
  const workSeconds = items.reduce(
    (total, item) => total + item.sets * (repsFromRange(item.reps) * 3 + item.restSeconds),
    0,
  );
  const transitions = items.length * 20;
  return Math.max(1, Math.round((workSeconds + transitions) / 60));
}

export function completedSetCount(entries: readonly StrengthEntry[]): number {
  return entries.reduce((acc, e) => acc + e.sets.filter((s) => s.completed).length, 0);
}

export function plannedSetCount(entries: readonly StrengthEntry[]): number {
  return entries.reduce((acc, e) => acc + e.sets.length, 0);
}

export function bestSet(entries: readonly StrengthEntry[]): {
  exerciseName: string;
  weightKg: number;
  reps: number;
} | null {
  let best: { exerciseName: string; weightKg: number; reps: number } | null = null;
  for (const entry of entries) {
    for (const set of entry.sets) {
      if (!set.completed || set.weightKg <= 0) continue;
      if (!best || set.weightKg > best.weightKg) {
        best = { exerciseName: entry.exerciseName, weightKg: set.weightKg, reps: set.reps };
      }
    }
  }
  return best;
}

/**
 * Personal records for a finished session, compared against prior history.
 * Only improvements are reported, which is what a user reads as "a PR".
 */
export function detectPersonalRecords(
  entries: readonly StrengthEntry[],
  history: readonly Activity[],
  atTime: number,
): PersonalRecord[] {
  const bestPrior = new Map<string, number>();
  for (const activity of history) {
    if (activity.startedAt >= atTime || !activity.strength) continue;
    for (const entry of activity.strength.entries) {
      for (const set of entry.sets) {
        if (!set.completed) continue;
        const key = `${entry.exerciseId}:est1rm`;
        const value = set.estimated1rm ?? estimatedOneRepMax(set.weightKg, set.reps) ?? 0;
        const current = bestPrior.get(key) ?? 0;
        if (value > current) bestPrior.set(key, value);
      }
    }
  }

  const records: PersonalRecord[] = [];
  const seen = new Set<string>();
  for (const entry of entries) {
    let best1rm = 0;
    let best1rmReps = 0;
    let bestReps = 0;
    for (const set of entry.sets) {
      if (!set.completed) continue;
      const est = set.estimated1rm ?? estimatedOneRepMax(set.weightKg, set.reps) ?? 0;
      if (est > best1rm) {
        best1rm = est;
        best1rmReps = set.reps;
      }
      if (set.reps > bestReps && set.weightKg > 0) bestReps = set.reps;
    }

    const key = `${entry.exerciseId}:est1rm`;
    const prior = bestPrior.get(key) ?? 0;
    if (best1rm > prior && best1rm > 0 && !seen.has(key)) {
      seen.add(key);
      records.push({
        exerciseId: entry.exerciseId,
        exerciseName: entry.exerciseName,
        kind: 'est1rm',
        value: best1rm,
        achievedAt: atTime,
        previousValue: prior > 0 ? prior : null,
      });
    }

    const repKey = `${entry.exerciseId}:maxReps`;
    const priorReps = bestPrior.get(repKey) ?? 0;
    if (bestReps > priorReps && bestReps >= 8 && !seen.has(repKey) && best1rmReps > 0) {
      seen.add(repKey);
      records.push({
        exerciseId: entry.exerciseId,
        exerciseName: entry.exerciseName,
        kind: 'maxReps',
        value: bestReps,
        achievedAt: atTime,
        previousValue: priorReps > 0 ? priorReps : null,
      });
    }
  }
  return records;
}

export function dayKey(date: Date | number): string {
  const d = typeof date === 'number' ? new Date(date) : date;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * Consecutive-day streak counting from the most recent activity. A day that has
 * not happened yet does not break the streak, "today" is only broken once it is
 * over, which matches how every streak product behaves.
 */
export function computeStreak(
  activities: readonly Pick<Activity, 'startedAt'>[],
  now: Date = new Date(),
): Streak {
  if (activities.length === 0) return { current: 0, longest: 0, activeDays: [] };

  const days = new Set(activities.map((a) => dayKey(a.startedAt)));
  const sorted = [...activities]
    .map((a) => new Date(a.startedAt))
    .sort((a, b) => a.getTime() - b.getTime());

  // Longest run of consecutive calendar days anywhere in history.
  let longest = 0;
  let run = 0;
  let previous: Date | null = null;
  for (const date of sorted) {
    const day = startOfDay(date);
    if (previous && daysBetween(previous, day) === 1) run += 1;
    else run = 1;
    longest = Math.max(longest, run);
    previous = day;
  }

  // Current streak: walk backwards from the last day that counts. Today counts
  // if trained; otherwise yesterday starts the run, since today is still open.
  const today = startOfDay(now);
  let probe: Date | null = days.has(dayKey(today)) ? today : dayBefore(today);
  if (probe && !days.has(dayKey(probe))) probe = null;

  let current = 0;
  while (probe && days.has(dayKey(probe))) {
    current += 1;
    probe = dayBefore(probe);
  }

  return { current, longest: Math.max(longest, current), activeDays: [...days].sort() };
}

function dayBefore(date: Date): Date {
  const d = startOfDay(date);
  d.setDate(d.getDate() - 1);
  return d;
}

/**
 * Rest remaining in **whole** seconds, computed from a wall-clock deadline so that
 * backgrounding the app cannot make the timer run slow or fast.
 *
 * The rounding belongs here rather than in the label, because "seconds" is what this
 * function's name promises: a raw `(endsAt - now) / 1000` leaked the millisecond
 * remainder into the countdown (`2:59.9799999999999`) and into the ±15s adjusters,
 * where it was silently re-rounded by `setRestTimer`: right answer, wrong arithmetic,
 * visible in the UI. Ceiling so the last partial second still reads `1` and the dock
 * disappears exactly at the deadline, not half a second early.
 */
export function restRemaining(
  restEndsAt: number | null,
  now: number = Date.now(),
): number {
  if (restEndsAt === null) return 0;
  return Math.max(0, Math.ceil((restEndsAt - now) / 1000));
}

export function sessionProgress(session: WorkoutSession): {
  completed: number;
  planned: number;
  ratio: number;
} {
  const completed = completedSetCount(session.entries);
  const planned = plannedSetCount(session.entries);
  return {
    completed,
    planned,
    ratio: planned === 0 ? 0 : completed / planned,
  };
}

export function sessionVolumeKg(session: WorkoutSession): number {
  return totalVolumeKg(session.entries);
}

/** Maps a finished session to the shape persisted as history. */
export function toCompletedWorkout(
  session: WorkoutSession,
  endedAt: number,
): CompletedWorkout {
  const durationSeconds = session.elapsedSeconds;
  return {
    id: session.id,
    routineId: session.routineId,
    title: session.routineName,
    startedAt: session.startedAt,
    endedAt,
    durationSeconds,
    caloriesKcal: estimateCalories(durationSeconds),
    entries: session.entries,
    totalVolumeKg: sessionVolumeKg(session),
    totalSets: completedSetCount(session.entries),
    notes: session.notes,
  };
}
