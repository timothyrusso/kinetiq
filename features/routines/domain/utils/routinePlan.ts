import type { RoutineItem, RoutineSet } from '@/features/routines/domain/schemas/RoutineSchema';

/** The seconds one rep takes, for the routine's time estimate. */
const SECONDS_PER_REP = 3;

/** The seconds between two exercises, for the routine's time estimate. */
const TRANSITION_SECONDS = 20;

/**
 * Planned volume for a routine: the sum of reps times weight over every planned loaded set, the
 * quantity a finished workout calls Volume, so the figure is what the routine lifts done as
 * planned. Bodyweight sets, reps-only and timed items add nothing, so such a routine plans 0.
 */
export function plannedVolumeKg(items: readonly RoutineItem[]): number {
  return items.reduce(
    (total, item) =>
      item.trackingType === 'weightReps'
        ? total + item.sets.reduce((sum, set) => sum + set.reps * Math.max(0, set.weightKg), 0)
        : total,
    0,
  );
}

/** The seconds one planned set works: its time when timed, three seconds a rep otherwise. */
function workSeconds(set: RoutineSet): number {
  return set.type === 'duration' ? set.durationSeconds : set.reps * SECONDS_PER_REP;
}

/**
 * The rough "about 55 min" on a routine: each set's work (its time, or three seconds a rep), the
 * item's rest after every set and twenty seconds between exercises. Never less than a minute.
 */
export function estimateMinutes(items: readonly RoutineItem[]): number {
  const seconds = items.reduce(
    (total, item) =>
      total + item.sets.reduce((sum: number, set: RoutineSet) => sum + workSeconds(set) + item.restSeconds, 0),
    0,
  );
  const transitions = items.length * TRANSITION_SECONDS;
  return Math.max(1, Math.round((seconds + transitions) / 60));
}
