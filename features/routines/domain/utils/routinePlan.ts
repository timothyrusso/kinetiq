import { repsFromRange } from '@/features/core/utils';
import type { RoutineItem } from '@/features/routines/domain/schemas/RoutineSchema';

/**
 * Planned load for a routine: the sum of sets times weight over its items. Bodyweight items add
 * nothing, so a bodyweight routine plans a volume of 0.
 */
export function plannedVolumeKg(items: readonly RoutineItem[]): number {
  return items.reduce((total, item) => total + item.sets * Math.max(0, item.weightKg), 0);
}

/**
 * The rough "about 55 min" on a routine: three seconds a rep, the item's rest after every set and
 * twenty seconds between exercises. Never less than a minute.
 */
export function estimateMinutes(items: readonly RoutineItem[]): number {
  const workSeconds = items.reduce(
    (total, item) => total + item.sets * (repsFromRange(item.reps) * 3 + item.restSeconds),
    0,
  );
  const transitions = items.length * 20;
  return Math.max(1, Math.round((workSeconds + transitions) / 60));
}
