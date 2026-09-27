import type { PreviousLift } from '@/features/workouts/domain/entities/PreviousLift';
import type { Activity } from '@/features/workouts/domain/schemas/ActivitySchema';
import { estimatedOneRepMax } from '@/features/workouts/domain/utils/workoutMath';

/**
 * The last time each wanted exercise was trained, from `history` newest first: the first hit per
 * exercise is the last time. An empty `wanted` indexes every exercise; a full `wanted` stops the
 * scan as soon as each has been found.
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
      const done = entry.sets.filter(set => set.completed || set.reps > 0);
      const best = done.reduce<number | null>((acc, set) => {
        const oneRm = set.estimated1rm ?? estimatedOneRepMax(set.weightKg, set.reps);
        return oneRm === null ? acc : acc === null || oneRm > acc ? oneRm : acc;
      }, null);
      byExercise.set(entry.exerciseId, {
        exerciseId: entry.exerciseId,
        exerciseName: entry.exerciseName,
        sets: done.map(set => ({
          reps: set.reps,
          weightKg: set.weightKg,
          estimated1rm: set.estimated1rm ?? estimatedOneRepMax(set.weightKg, set.reps),
        })),
        bestEstimated1rm: best,
        totalVolumeKg: entry.sets.reduce((acc, set) => acc + set.reps * set.weightKg, 0),
        performedAt: activity.startedAt,
      });
    }
    if (wanted.size > 0 && byExercise.size >= wanted.size) break;
  }
  return byExercise;
}
