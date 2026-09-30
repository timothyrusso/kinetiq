import type { MetaItem } from '@/features/core/design-system';
import { tr } from '@/features/core/translations';
import { formatWeight, type UnitSystem } from '@/features/core/utils';
import type { RoutineItem, RoutineSet } from '@/features/routines/domain/schemas/RoutineSchema';

/** The item's reps: one number when every set has it, otherwise the fewest and the most. */
function repsLabel(sets: readonly RoutineSet[]): string {
  const reps = sets.map(set => set.reps);
  const low = Math.min(...reps);
  const high = Math.max(...reps);
  return low === high ? `${low}` : `${low}-${high}`;
}

/**
 * Sets, reps and load, as three items. The load is the first set's. Weight is the one number the
 * unit setting changes; a bodyweight item says so instead of `0 kg`.
 */
export function itemMeta(item: RoutineItem, units: UnitSystem): MetaItem[] {
  const weightKg = item.sets[0]?.weightKg ?? 0;
  const load = weightKg === 0 ? tr('itemEditor.bodyweightShort') : formatWeight(weightKg, units);
  const meta: MetaItem[] = [{ icon: 'layers', label: tr('workout.set', { count: item.sets.length }) }];
  if (item.sets.length > 0)
    meta.push({ icon: 'refresh', label: tr('details.repsValue', { reps: repsLabel(item.sets) }) });
  meta.push({ icon: 'dumbbell', label: load, ...(weightKg === 0 ? { a11y: tr('details.bodyweightA11y') } : {}) });
  return meta;
}
