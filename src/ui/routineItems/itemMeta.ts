import { formatWeight, type UnitSystem } from '@/utils/format';
import type { RoutineItem } from '@/domain/types';
import { tr } from '@/i18n/tr';
import type { MetaItem } from '@/ui/display/types';

/**
 * Sets, reps and load, as three items.
 *
 * Weight is the only number here the unit setting changes, so it is the only one
 * formatted; reps and sets are unit-free. A missing snapshot costs the muscle tag and
 * nothing else: which is exactly why the exercise name is stored on the item.
 */
export function itemMeta(item: RoutineItem, units: UnitSystem): MetaItem[] {
  const load = item.weightKg === 0 ? tr('itemEditor.bodyweightShort') : formatWeight(item.weightKg, units);
  return [
    { icon: 'layers', label: tr('workout.set', { count: item.sets }) },
    { icon: 'refresh', label: tr('details.repsValue', { reps: item.reps }) },
    {
      icon: 'dumbbell',
      label: load,
      ...(item.weightKg === 0 ? { a11y: tr('details.bodyweightA11y') } : {}),
    },
  ];
}
