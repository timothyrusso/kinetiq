import { sum } from '@/features/core/utils';
import type { CompletedWorkout } from '@/features/workouts/domain/schemas/CompletedWorkoutSchema';
import type { StrengthEntry, StrengthSet } from '@/features/workouts/domain/schemas/StrengthEntrySchema';
import type { WorkoutSession } from '@/features/workouts/domain/schemas/WorkoutSessionSchema';
import { withSets } from '@/features/workouts/domain/utils/trackingSets';

/** Reps times load, kilograms. Only a loaded set has volume: reps alone and time have none. */
export function setVolumeKg(set: StrengthSet): number {
  return set.type === 'weightReps' ? Math.max(0, set.reps) * Math.max(0, set.weightKg) : 0;
}

function entryVolumeKg(entry: Pick<StrengthEntry, 'sets'>): number {
  return sum(entry.sets.filter(set => set.completed).map(setVolumeKg));
}

/** Volume over the completed loaded sets of every entry, rounded to the kilogram. */
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

/** An entry as history keeps it: without the routine item and set rows it was planned from. */
function recordedEntry({ routineItemId: _item, ...entry }: StrengthEntry): StrengthEntry {
  return withSets(
    entry,
    entry.sets.map(({ routineSetIndex: _row, ...set }) => set),
  );
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
    entries: session.entries.map(recordedEntry),
    totalVolumeKg: totalVolumeKg(session.entries),
    totalSets: completedSetCount(session.entries),
    notes: session.notes,
  };
}
