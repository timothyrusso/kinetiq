import type { MetaItem } from '@/features/core/design-system';
import { tr } from '@/features/core/translations';
import { formatWeight, type UnitSystem } from '@/features/core/utils';
import type { RoutineItem } from '@/features/routines/domain/schemas/RoutineSchema';

/**
 * Sets, reps and load, as three items. Weight is the one number the unit setting changes; a
 * bodyweight item says so instead of `0 kg`.
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
