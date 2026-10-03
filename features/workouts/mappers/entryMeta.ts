import type { MetaItem } from '@/features/core/design-system';
import { tr } from '@/features/core/translations';
import { formatWeight, type UnitSystem } from '@/features/core/utils';
import type { StrengthEntry, StrengthSet } from '@/features/workouts/domain/schemas/StrengthEntrySchema';

/** The exercise's reps: one number when every set has it, otherwise the fewest and the most. */
function repsLabel(sets: readonly StrengthSet[]): string {
  const reps = sets.map(set => set.reps);
  const low = Math.min(...reps);
  const high = Math.max(...reps);
  return low === high ? `${low}` : `${low}-${high}`;
}

/**
 * Sets, reps, load and how many sets are done, the routine item's summary with the workout's own
 * fact after it. The load is the first set's; a bodyweight exercise says so instead of `0 kg`.
 */
export function entryMeta(entry: StrengthEntry, units: UnitSystem): MetaItem[] {
  const { sets } = entry;
  const weightKg = sets[0]?.weightKg ?? 0;
  const load = weightKg === 0 ? tr('itemEditor.bodyweightShort') : formatWeight(weightKg, units);
  const done = sets.filter(set => set.completed).length;
  const meta: MetaItem[] = [{ icon: 'layers', label: tr('workout.set', { count: sets.length }) }];
  if (sets.length > 0) meta.push({ icon: 'refresh', label: tr('details.repsValue', { reps: repsLabel(sets) }) });
  meta.push({ icon: 'dumbbell', label: load, ...(weightKg === 0 ? { a11y: tr('details.bodyweightA11y') } : {}) });
  meta.push({
    icon: 'checkCircle',
    label: `${done}/${sets.length}`,
    a11y: tr('workoutFlow.setsDone', {
      done,
      planned: sets.length,
      word: tr('session.setWord', { count: sets.length }),
    }),
  });
  return meta;
}
