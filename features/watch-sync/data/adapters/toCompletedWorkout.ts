import type { WatchWorkoutDocument } from '@/features/watch-bridge';
import {
  ActivityId,
  type CompletedWorkout,
  completedSetCount,
  estimatedOneRepMax,
  type StrengthEntry,
  totalVolumeKg,
} from '@/features/workouts';

/** Activity ids of watch workouts, so history can tell them from `session-` ones. */
const watchActivityId = (uuid: string) => ActivityId.make(`watch-${uuid}`);

/**
 * A checked `kinetiq.watch-workout` document as the workout history records. The computed fields
 * are derived exactly as a phone session derives them, except the duration, which for a watch
 * workout is wall clock.
 */
export function toCompletedWorkout(document: WatchWorkoutDocument): CompletedWorkout {
  const startedAt = Date.parse(document.startedAt);
  const endedAt = Date.parse(document.endedAt);
  const durationSeconds = Math.round((endedAt - startedAt) / 1000);
  const entries: StrengthEntry[] = document.entries.map(entry => ({
    exerciseId: entry.exerciseId,
    exerciseName: entry.exerciseName,
    muscleGroup: null,
    restSeconds: entry.restSeconds,
    notes: entry.notes,
    sets: entry.sets.map(set => ({
      index: set.index,
      reps: set.reps,
      weightKg: set.weightKg,
      completed: set.completed,
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
    entries,
    totalVolumeKg: totalVolumeKg(entries),
    totalSets: completedSetCount(entries),
    notes: document.notes,
  };
}
