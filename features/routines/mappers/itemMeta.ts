import type { MetaItem } from '@/features/core/design-system';
import { tr } from '@/features/core/translations';
import { formatTimer, formatWeight, type UnitSystem } from '@/features/core/utils';
import type { RoutineItem } from '@/features/routines/domain/schemas/RoutineSchema';

/** One label for every set's value: one value when every set has it, otherwise the fewest and the most. */
function rangeLabel(values: readonly number[], format: (value: number) => string): string {
  const low = Math.min(...values);
  const high = Math.max(...values);
  return low === high ? format(low) : `${format(low)}-${format(high)}`;
}

/** The planned values after the set count, in the item's own units. */
function valueMeta(item: RoutineItem, units: UnitSystem): MetaItem[] {
  if (item.sets.length === 0) return [];
  switch (item.trackingType) {
    case 'weightReps': {
      const reps = rangeLabel(
        item.sets.map(set => set.reps),
        String,
      );
      const weightKg = item.sets[0]?.weightKg ?? 0;
      const load = weightKg === 0 ? tr('itemEditor.bodyweightShort') : formatWeight(weightKg, units);
      return [
        { icon: 'refresh', label: tr('details.repsValue', { reps }) },
        { icon: 'dumbbell', label: load, ...(weightKg === 0 ? { a11y: tr('details.bodyweightA11y') } : {}) },
      ];
    }
    case 'repsOnly': {
      const reps = rangeLabel(
        item.sets.map(set => set.reps),
        String,
      );
      return [{ icon: 'refresh', label: tr('details.repsValue', { reps }) }];
    }
    case 'duration':
      return [
        {
          icon: 'timer',
          label: rangeLabel(
            item.sets.map(set => set.durationSeconds),
            formatTimer,
          ),
        },
      ];
  }
}

/**
 * Sets and the values the item's type plans. A loaded item shows its reps and the first set's
 * load (weight is the one number the unit setting changes), a bodyweight one says so instead of
 * `0 kg`; a reps-only item shows its reps; a timed one its time per set, as `m:ss`.
 */
export function itemMeta(item: RoutineItem, units: UnitSystem): MetaItem[] {
  return [{ icon: 'layers', label: tr('workout.set', { count: item.sets.length }) }, ...valueMeta(item, units)];
}
