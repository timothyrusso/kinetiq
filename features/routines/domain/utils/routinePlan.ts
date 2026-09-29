import type { RoutineItem } from '@/features/routines/domain/schemas/RoutineSchema';

/**
 * Planned volume for a routine: the sum of reps times weight over every planned set, the quantity
 * a finished workout calls Volume, so the figure is what the routine lifts done as planned.
 * Bodyweight sets add nothing, so a bodyweight routine plans a volume of 0.
 */
export function plannedVolumeKg(items: readonly RoutineItem[]): number {
  return items.reduce(
    (total, item) => total + item.sets.reduce((sum, set) => sum + set.reps * Math.max(0, set.weightKg), 0),
    0,
  );
}

/**
 * The rough "about 55 min" on a routine: three seconds a rep, the item's rest after every set and
 * twenty seconds between exercises. Never less than a minute.
 */
export function estimateMinutes(items: readonly RoutineItem[]): number {
  const workSeconds = items.reduce(
    (total, item) => total + item.sets.reduce((sum, set) => sum + set.reps * 3 + item.restSeconds, 0),
    0,
  );
  const transitions = items.length * 20;
  return Math.max(1, Math.round((workSeconds + transitions) / 60));
}
