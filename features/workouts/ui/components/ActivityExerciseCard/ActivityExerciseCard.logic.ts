import { useCallback, useMemo } from 'react';
import type { PressableStateCallbackType, StyleProp, ViewStyle } from 'react-native';
import { type MetaItem, type Tag, useStyles } from '@/features/core/design-system';
import { type TKey, useT } from '@/features/core/translations';
import { formatWeight, joinMiddleDot, type UnitSystem } from '@/features/core/utils';
import type { StrengthEntry, StrengthSet } from '@/features/workouts/domain/schemas/StrengthEntrySchema';
import { estimatedOneRepMax } from '@/features/workouts/domain/utils/workoutMath';
import { createStyles } from '@/features/workouts/ui/components/ActivityExerciseCard/ActivityExerciseCard.style';

/**
 * The heaviest completed set by estimated max, or `null` when nothing was completed. The stored
 * estimate wins; the recompute covers rows written before the field existed.
 */
function heaviestCompletedSet(sets: readonly StrengthSet[]): StrengthSet | null {
  let best: StrengthSet | null = null;
  let bestMax = -1;
  for (const set of sets) {
    if (!set.completed) continue;
    const max = set.estimated1rm ?? estimatedOneRepMax(set.weightKg, set.reps) ?? set.weightKg;
    if (max > bestMax) {
      best = set;
      bestMax = max;
    }
  }
  return best;
}

/**
 * A set's estimated ceiling, or a dash: there is none for bodyweight work or past 15 reps, where
 * Epley extrapolates, and an invented ceiling over 25 bodyweight reps is the number to avoid.
 */
function oneRepMaxLabel(set: StrengthSet, units: UnitSystem): string {
  if (!set.completed) return '-';
  const max = set.estimated1rm ?? estimatedOneRepMax(set.weightKg, set.reps);
  return max === null ? '-' : formatWeight(max, units);
}

/** One exercise's badge, facts and set rows, and the press that opens the exercise. */
export function useActivityExerciseCardLogic(
  entry: StrengthEntry,
  units: UnitSystem,
  onOpen: (exerciseId: string) => void,
) {
  const { t } = useT();
  const styles = useStyles(createStyles);
  const top = useMemo(() => heaviestCompletedSet(entry.sets), [entry.sets]);
  const done = entry.sets.filter(set => set.completed).length;
  const planned = entry.sets.length;
  const meta = useMemo<MetaItem[]>(
    () => [
      { icon: 'layers', label: `${done}/${planned} ${t('activity.setWord', { count: planned })}` },
      ...(top
        ? [
            {
              icon: 'trophy' as const,
              label: t('activity.topSet', {
                weight: top.weightKg === 0 ? t('activity.bodyweightShort') : formatWeight(top.weightKg, units),
                reps: top.reps,
              }),
            },
          ]
        : []),
    ],
    [done, planned, t, top, units],
  );
  const tags = useMemo<Tag[]>(
    () => (entry.muscleGroup ? [{ key: 'muscle', label: entry.muscleGroup }] : []),
    [entry.muscleGroup],
  );
  const sets = useMemo(
    () =>
      entry.sets.map((set, index) => ({
        key: `${set.index}-${index}`,
        number: index + 1,
        completed: set.completed,
        weight: set.weightKg === 0 ? t('activity.bodyweightShort') : formatWeight(set.weightKg, units),
        reps: set.reps,
        oneRepMax: oneRepMaxLabel(set, units),
        accessibilityLabel: set.completed
          ? joinMiddleDot([
              t('activity.setNumber', { n: index + 1 }),
              set.weightKg === 0 ? t('activity.bodyweight') : formatWeight(set.weightKg, units),
              `${set.reps} ${t('activity.repWord', { count: set.reps })}`,
            ])
          : t('activity.setNotDone', { n: index + 1 }),
      })),
    [entry.sets, t, units],
  );
  const badge = useMemo(
    () =>
      done === 0
        ? { label: t('activity.skipped'), tone: 'warning' as const }
        : done === planned
          ? { label: t('activity.allDone'), tone: 'success' as const }
          : { label: `${done}/${planned}`, tone: 'neutral' as const },
    [done, planned, t],
  );
  const headStyle = useCallback(
    ({ pressed }: PressableStateCallbackType): StyleProp<ViewStyle> => [styles.shrink, pressed ? styles.pressed : null],
    [styles],
  );
  const open = useCallback(() => onOpen(entry.exerciseId), [onOpen, entry.exerciseId]);
  const weightColumn: TKey = units === 'metric' ? 'activity.colKg' : 'activity.colLb';
  return {
    derived: { meta, tags, sets, badge, headStyle, weightColumn, hasSets: planned > 0 },
    effects: { open },
  };
}
