import type { Activity } from '@/features/workouts/domain/schemas/ActivitySchema';
import type { PersonalRecord, PersonalRecordKind } from '@/features/workouts/domain/schemas/PersonalRecordSchema';
import type { StrengthEntry } from '@/features/workouts/domain/schemas/StrengthEntrySchema';
import { setEstimate } from '@/features/workouts/domain/utils/oneRepMax';

/** A loaded set needs this many reps before its rep count is a record. */
const MAX_REPS_THRESHOLD = 8;

type Bests = Map<PersonalRecordKind, number>;

function raise(bests: Bests, kind: PersonalRecordKind, value: number): void {
  if (value > (bests.get(kind) ?? 0)) bests.set(kind, value);
}

/**
 * The bests of one entry's completed sets, by the kinds its type records: the estimated max and
 * the most reps in a loaded set; the most reps; or the longest set.
 */
function entryBests(entry: StrengthEntry): Bests {
  const bests: Bests = new Map();
  switch (entry.trackingType) {
    case 'weightReps':
      for (const set of entry.sets) {
        if (!set.completed) continue;
        raise(bests, 'est1rm', setEstimate(set) ?? 0);
        if (set.weightKg > 0) raise(bests, 'maxReps', set.reps);
      }
      break;
    case 'repsOnly':
      for (const set of entry.sets) if (set.completed) raise(bests, 'mostReps', set.reps);
      break;
    case 'duration':
      for (const set of entry.sets) if (set.completed) raise(bests, 'longestDuration', set.durationSeconds);
      break;
  }
  return bests;
}

/** The smallest value of `kind` a workout reports as a record. */
function isRecordValue(kind: PersonalRecordKind, value: number): boolean {
  return kind === 'maxReps' ? value >= MAX_REPS_THRESHOLD : value > 0;
}

/**
 * The records a finished workout sets, against the history before `atTime`, per exercise and
 * kind. Only improvements are reported, which is what a user reads as "a PR": a heavier estimated
 * max, more reps than ever on a loaded set of eight or more, more reps on a reps-only set, or a
 * longer timed set. Each kind compares only with sets of the type that records it.
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
      for (const [kind, value] of entryBests(entry)) {
        const key = `${entry.exerciseId}:${kind}`;
        if (value > (bestPrior.get(key) ?? 0)) bestPrior.set(key, value);
      }
    }
  }

  const records: PersonalRecord[] = [];
  const seen = new Set<string>();
  for (const entry of entries) {
    for (const [kind, value] of entryBests(entry)) {
      const key = `${entry.exerciseId}:${kind}`;
      const prior = bestPrior.get(key) ?? 0;
      if (value <= prior || !isRecordValue(kind, value) || seen.has(key)) continue;
      seen.add(key);
      records.push({
        exerciseId: entry.exerciseId,
        exerciseName: entry.exerciseName,
        kind,
        value,
        achievedAt: atTime,
        previousValue: prior > 0 ? prior : null,
      });
    }
  }
  return records;
}
