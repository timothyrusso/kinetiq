import { sum } from '@/features/core/utils';
import type { CompletedWorkout } from '@/features/workouts/domain/schemas/CompletedWorkoutSchema';
import type { StrengthEntry, StrengthSet } from '@/features/workouts/domain/schemas/StrengthEntrySchema';
import type { WorkoutSession } from '@/features/workouts/domain/schemas/WorkoutSessionSchema';

/**
 * MET-based calorie model for resistance training, scaled for a 74 kg reference athlete.
 * Deliberately simple and monotonic: a fitness app's calorie number is an estimate the user
 * trends against, not a measurement.
 */
const LIFT_MET = 5.0;

/** Kilocalories for a lifting session of `durationSeconds`. */
export function estimateCalories(durationSeconds: number): number {
  const hours = Math.max(0, durationSeconds) / 3600;
  return Math.round(LIFT_MET * 74 * hours);
}

function roundKg(value: number): number {
  return Math.round(value * 2) / 2;
}

/**
 * Epley, to the half kilogram. Null for bodyweight work and past 15 reps, where the linear model
 * extrapolates rather than estimates.
 */
export function estimatedOneRepMax(weightKg: number, reps: number): number | null {
  if (weightKg <= 0 || reps <= 0) return null;
  if (reps === 1) return roundKg(weightKg);
  if (reps > 15) return null;
  return roundKg(weightKg * (1 + reps / 30));
}

/** A completed set with its estimate refreshed; an open set is returned as it is. */
export function withEstimated1rm(set: StrengthSet): StrengthSet {
  if (!set.completed) return set;
  return { ...set, estimated1rm: estimatedOneRepMax(set.weightKg, set.reps) };
}

export function setVolumeKg(set: Pick<StrengthSet, 'reps' | 'weightKg'>): number {
  return Math.max(0, set.reps) * Math.max(0, set.weightKg);
}

function entryVolumeKg(entry: Pick<StrengthEntry, 'sets'>): number {
  return sum(entry.sets.filter(set => set.completed).map(setVolumeKg));
}

/** Volume over the completed sets of every entry, rounded to the kilogram. */
export function totalVolumeKg(entries: readonly StrengthEntry[]): number {
  return Math.round(sum(entries.map(entryVolumeKg)));
}

export function completedSetCount(entries: readonly StrengthEntry[]): number {
  return entries.reduce((acc, entry) => acc + entry.sets.filter(set => set.completed).length, 0);
}

function plannedSetCount(entries: readonly StrengthEntry[]): number {
  return entries.reduce((acc, entry) => acc + entry.sets.length, 0);
}

/**
 * Rest remaining in whole seconds, from the wall-clock deadline, so backgrounding the app cannot
 * make the timer run slow or fast. Ceiling, so the last partial second still reads 1 and the dock
 * leaves exactly at the deadline.
 */
export function restRemaining(restEndsAt: number | null, now: number): number {
  if (restEndsAt === null) return 0;
  return Math.max(0, Math.ceil((restEndsAt - now) / 1000));
}

/** Sets done over sets planned. */
export interface SessionProgress {
  readonly completed: number;
  readonly planned: number;
  /** `completed / planned`, 0 for a session with no sets. */
  readonly ratio: number;
}

export function sessionProgress(session: Pick<WorkoutSession, 'entries'>): SessionProgress {
  const completed = completedSetCount(session.entries);
  const planned = plannedSetCount(session.entries);
  return { completed, planned, ratio: planned === 0 ? 0 : completed / planned };
}

/** The shape a finished session is recorded as. Its duration is the counted time, not the wall. */
export function toCompletedWorkout(session: WorkoutSession, endedAt: number): CompletedWorkout {
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
    totalVolumeKg: totalVolumeKg(session.entries),
    totalSets: completedSetCount(session.entries),
    notes: session.notes,
  };
}
