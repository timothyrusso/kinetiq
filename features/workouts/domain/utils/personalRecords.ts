import type { Activity } from '@/features/workouts/domain/schemas/ActivitySchema';
import type { PersonalRecord } from '@/features/workouts/domain/schemas/PersonalRecordSchema';
import type { StrengthEntry } from '@/features/workouts/domain/schemas/StrengthEntrySchema';
import { estimatedOneRepMax } from '@/features/workouts/domain/utils/workoutMath';

/**
 * The records a finished workout sets, against the history before `atTime`. Only improvements
 * are reported, which is what a user reads as "a PR": a heavier estimated max, or (on a set of
 * eight or more with load) more reps than ever.
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
        if (set.weightKg > 0) {
          const repKey = `${entry.exerciseId}:maxReps`;
          if (set.reps > (bestPrior.get(repKey) ?? 0)) bestPrior.set(repKey, set.reps);
        }
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
