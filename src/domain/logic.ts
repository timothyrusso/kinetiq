/**
 * Domain rules that the UI must never re-implement: energy expenditure,
 * estimated one-rep max, streaks and derived totals.
 */
import type {
  Activity,
  ActivityKind,
  CompletedWorkout,
  PersonalRecord,
  StrengthEntry,
  StrengthSet,
  Streak,
  WorkoutSession,
} from './types';
import { daysBetween, startOfDay } from '@/utils/format';
import { sum } from '@/utils/functional';

/**
 * MET-based calorie model, scaled for a 74 kg reference athlete. Deliberately
 * simple and monotonic: a fitness app's calorie number is an estimate the user
 * trends against, not a measurement.
 */
const MET_BY_KIND: Record<ActivityKind, number> = {
  run: 9.8,
  ride: 7.5,
  lift: 5.0,
  walk: 3.5,
  yoga: 3.0,
};

export function estimateCalories(
  kind: ActivityKind,
  durationSeconds: number,
  options: { intensity?: number; distanceMeters?: number } = {},
): number {
  const met = MET_BY_KIND[kind] * (options.intensity ?? 1);
  const hours = Math.max(0, durationSeconds) / 3600;
  const base = met * 74 * hours;
  // Running gets a distance term: effort scales with work done, not just time.
  if (kind === 'run' && options.distanceMeters) {
    return Math.round(base * 0.6 + options.distanceMeters * 0.062);
  }
  return Math.round(base);
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
 * not happened yet does not break the streak — "today" is only broken once it is
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

/** Rest remaining in seconds, computed from a wall-clock deadline so that
 * backgrounding the app cannot make the timer run slow or fast. */
export function restRemaining(
  restEndsAt: number | null,
  now: number = Date.now(),
): number {
  if (restEndsAt === null) return 0;
  return Math.max(0, (restEndsAt - now) / 1000);
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
    caloriesKcal: estimateCalories('lift', durationSeconds),
    entries: session.entries,
    totalVolumeKg: sessionVolumeKg(session),
    totalSets: completedSetCount(session.entries),
    notes: session.notes,
  };
}

/** Calories/minute used by the live session ticker. */
export function caloriesRate(kind: ActivityKind, intensity = 1): number {
  return (MET_BY_KIND[kind] * intensity * 74) / 60;
}

/** Pace from raw totals, guarding the zero-distance case. */
export function paceFromDistance(durationSeconds: number, distanceMeters: number): number {
  if (distanceMeters <= 0 || durationSeconds <= 0) return 0;
  return durationSeconds / (distanceMeters / 1000);
}

export function speedFromDistance(
  durationSeconds: number,
  distanceMeters: number,
): number {
  if (durationSeconds <= 0) return 0;
  return distanceMeters / durationSeconds;
}
