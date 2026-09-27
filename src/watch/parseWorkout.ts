/**
 * Reads a `kinetiq.watch-workout` document from the native inbox (issue #27).
 *
 * The document is checked by its Schema in `features/watch-bridge` (format, version, size, types,
 * and the same bounds the routine editor enforces); a document that fails is never partly saved.
 * The computed fields are derived here exactly as `toCompletedWorkout` derives them for a phone
 * session, except duration, which for a watch workout is wall clock.
 */
import {
  ActivityId,
  type CompletedWorkout,
  completedSetCount,
  estimateCalories,
  estimatedOneRepMax,
  type StrengthEntry,
  totalVolumeKg,
} from '@/features/workouts';
import { readWatchWorkout, type WatchInboxEntry, type WatchWorkoutDocument } from '@/features/watch-bridge';

export type ParsedWorkout =
  | { ok: true; workout: CompletedWorkout }
  /** `version`: a newer watch app; worth keeping until the phone app catches up. */
  | { ok: false; reason: 'version' | 'invalid' };

/** Activity ids of watch workouts, so history can tell them from `session-` ones. */
const watchActivityId = (uuid: string) => ActivityId.make(`watch-${uuid}`);

export function parseWatchWorkout(entry: WatchInboxEntry): ParsedWorkout {
  const read = readWatchWorkout(entry);
  return read.ok ? { ok: true, workout: toWorkout(read.document) } : { ok: false, reason: read.reason };
}

function toWorkout(document: WatchWorkoutDocument): CompletedWorkout {
  const startedAt = Date.parse(document.startedAt);
  const endedAt = Date.parse(document.endedAt);
  const durationSeconds = Math.round((endedAt - startedAt) / 1000);
  const entries: StrengthEntry[] = document.entries.map((entry) => ({
    exerciseId: entry.exerciseId,
    exerciseName: entry.exerciseName,
    muscleGroup: null,
    restSeconds: entry.restSeconds,
    notes: entry.notes,
    sets: entry.sets.map((set) => ({
      index: set.index,
      reps: set.reps,
      weightKg: set.weightKg,
      completed: set.completed,
      // As `withEstimated1rm` in the session engine: completed sets only.
      estimated1rm: set.completed ? estimatedOneRepMax(set.weightKg, set.reps) : null,
      rpe: set.rpe,
    })),
  }));

  return {
    id: watchActivityId(document.id),
    routineId: document.routineId,
    title: document.title,
    startedAt,
    endedAt,
    durationSeconds,
    caloriesKcal: estimateCalories(durationSeconds),
    entries,
    totalVolumeKg: totalVolumeKg(entries),
    totalSets: completedSetCount(entries),
    notes: document.notes,
  };
}
