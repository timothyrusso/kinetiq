import { sum } from '@/features/core/utils';
import type { PreviousLift, PreviousSet } from '@/features/workouts/domain/entities/PreviousLift';
import type { Activity } from '@/features/workouts/domain/schemas/ActivitySchema';
import type { StrengthSet } from '@/features/workouts/domain/schemas/StrengthEntrySchema';
import { setEstimate } from '@/features/workouts/domain/utils/oneRepMax';
import { setVolumeKg } from '@/features/workouts/domain/utils/workoutMath';

/** A done set as last time shows it: the values its type records. */
function previousSet(set: StrengthSet): PreviousSet {
  switch (set.type) {
    case 'weightReps':
      return { type: set.type, reps: set.reps, weightKg: set.weightKg, estimated1rm: setEstimate(set) };
    case 'repsOnly':
      return { type: set.type, reps: set.reps };
    case 'duration':
      return { type: set.type, durationSeconds: set.durationSeconds };
  }
}

/** The best estimate among `sets`, or null when no loaded set has one. */
function bestEstimate(sets: readonly PreviousSet[]): number | null {
  const estimates = sets.flatMap(set =>
    set.type === 'weightReps' && set.estimated1rm !== null ? [set.estimated1rm] : [],
  );
  return estimates.length === 0 ? null : Math.max(...estimates);
}

/**
 * The last time each wanted exercise was trained, from `history` newest first: the first workout
 * with a ticked set of it is the last time, whatever type it was tracked as then. A set counts
 * only when it was ticked, as in the history: a finished workout keeps its un-ticked planned
 * sets, and those were never done. An empty `wanted` indexes every exercise; a full `wanted`
 * stops the scan as soon as each has been found.
 */
export function indexPreviousLifts(
  history: readonly Activity[],
  wanted: ReadonlySet<string>,
): ReadonlyMap<string, PreviousLift> {
  const byExercise = new Map<string, PreviousLift>();
  for (const activity of history) {
    for (const entry of activity.strength?.entries ?? []) {
      if (wanted.size > 0 && !wanted.has(entry.exerciseId)) continue;
      if (byExercise.has(entry.exerciseId)) continue;
      const done: StrengthSet[] = entry.sets.filter(set => set.completed);
      if (done.length === 0) continue;
      const sets = done.map(previousSet);
      byExercise.set(entry.exerciseId, {
        exerciseId: entry.exerciseId,
        exerciseName: entry.exerciseName,
        trackingType: entry.trackingType,
        sets,
        bestEstimated1rm: bestEstimate(sets),
        totalVolumeKg: sum(done.map(setVolumeKg)),
        performedAt: activity.startedAt,
      });
    }
    if (wanted.size > 0 && byExercise.size >= wanted.size) break;
  }
  return byExercise;
}
