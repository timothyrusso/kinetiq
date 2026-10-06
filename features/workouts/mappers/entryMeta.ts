import type { MetaItem } from '@/features/core/design-system';
import { tr } from '@/features/core/translations';
import { formatTimer, formatWeight, type UnitSystem } from '@/features/core/utils';
import type { StrengthEntry } from '@/features/workouts/domain/schemas/StrengthEntrySchema';

/** One label for every set's value: one value when every set has it, otherwise the fewest and the most. */
function rangeLabel(values: readonly number[], format: (value: number) => string): string {
  const low = Math.min(...values);
  const high = Math.max(...values);
  return low === high ? format(low) : `${format(low)}-${format(high)}`;
}

/** The facts between the set count and the done count, in the entry's own units. */
function valueMeta(entry: StrengthEntry, units: UnitSystem): MetaItem[] {
  if (entry.sets.length === 0) return [];
  switch (entry.trackingType) {
    case 'weightReps': {
      const reps = rangeLabel(
        entry.sets.map(set => set.reps),
        String,
      );
      const weightKg = entry.sets[0]?.weightKg ?? 0;
      const load = weightKg === 0 ? tr('itemEditor.bodyweightShort') : formatWeight(weightKg, units);
      return [
        { icon: 'refresh', label: tr('details.repsValue', { reps }) },
        { icon: 'dumbbell', label: load, ...(weightKg === 0 ? { a11y: tr('details.bodyweightA11y') } : {}) },
      ];
    }
    case 'repsOnly':
      return [
        {
          icon: 'refresh',
          label: tr('details.repsValue', {
            reps: rangeLabel(
              entry.sets.map(set => set.reps),
              String,
            ),
          }),
        },
      ];
    case 'duration':
      return [
        {
          icon: 'timer',
          label: rangeLabel(
            entry.sets.map(set => set.durationSeconds),
            formatTimer,
          ),
        },
      ];
  }
}

/**
 * Sets, the values the entry's type records, and how many sets are done: the routine item's
 * summary with the workout's own fact after it. A loaded exercise shows its reps and the first
 * set's load, a bodyweight one says so instead of `0 kg`; a reps-only one shows its reps; a timed
 * one its time per set, as `m:ss`.
 */
export function entryMeta(entry: StrengthEntry, units: UnitSystem): MetaItem[] {
  const { sets } = entry;
  const done = sets.filter(set => set.completed).length;
  return [
    { icon: 'layers', label: tr('workout.set', { count: sets.length }) },
    ...valueMeta(entry, units),
    {
      icon: 'checkCircle',
      label: `${done}/${sets.length}`,
      a11y: tr('workoutFlow.setsDone', {
        done,
        planned: sets.length,
        word: tr('session.setWord', { count: sets.length }),
      }),
    },
  ];
}
