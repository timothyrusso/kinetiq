import { tr } from '@/features/core/translations';
import { formatTimer, formatWeight, type UnitSystem } from '@/features/core/utils';
import type { PreviousLift, PreviousSet } from '@/features/workouts/domain/entities/PreviousLift';

/** What ranks a set of last time against the others of its type: its load, its reps, its time. */
function scoreOf(set: PreviousSet): number {
  switch (set.type) {
    case 'weightReps':
      return set.weightKg;
    case 'repsOnly':
      return set.reps;
    case 'duration':
      return set.durationSeconds;
  }
}

function labelOf(set: PreviousSet, units: UnitSystem): string {
  switch (set.type) {
    case 'weightReps':
      return set.weightKg === 0
        ? tr('exerciseDetail.bodyweightTimes', { reps: set.reps })
        : `${formatWeight(set.weightKg, units)} × ${set.reps}`;
    case 'repsOnly':
      return tr('details.repsValue', { reps: set.reps });
    case 'duration':
      return formatTimer(set.durationSeconds);
  }
}

/**
 * The best set of last time, in what that workout recorded: the heaviest load and its reps (or
 * bodyweight and its reps), the most reps, or the longest hold, the first one on a tie. `null`
 * when no set was recorded. Last time's type need not be today's: the value says what was done.
 */
export function lastTimeValue(lift: PreviousLift, units: UnitSystem): string | null {
  let best: PreviousSet | null = null;
  for (const set of lift.sets) {
    if (best === null || scoreOf(set) > scoreOf(best)) best = set;
  }
  return best === null ? null : labelOf(best, units);
}
