import { useCallback, useMemo } from 'react';
import type { PressableStateCallbackType, StyleProp, ViewStyle } from 'react-native';
import { type MetaItem, type Tag, useStyles } from '@/features/core/design-system';
import { type TKey, useT } from '@/features/core/translations';
import { formatWeight, joinMiddleDot, trimNumber, type UnitSystem } from '@/features/core/utils';
import type { StrengthEntry, StrengthSet } from '@/features/workouts/domain/schemas/StrengthEntrySchema';
import { weightRepsView } from '@/features/workouts/mappers/weightRepsView';
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
    const view = weightRepsView(set);
    const max = view.estimated1rm ?? view.weightKg;
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
  const max = weightRepsView(set).estimated1rm;
  return max === null ? '-' : formatWeight(max, units);
}

/**
 * The effort noted on a completed set, or `null`: the set sheet stores 0 as null, and a set not
 * done carries only the routine's target, which is not what was felt.
 */
function notedRpe(set: StrengthSet): number | null {
  return set.completed && set.rpe !== null && set.rpe > 0 ? set.rpe : null;
}

/** One exercise's badge, facts and set rows, and the press that opens the exercise. */
export function useActivityExerciseCardLogic(
  entry: StrengthEntry,
  units: UnitSystem,
  onOpen: (exerciseId: string) => void,
) {
  const { t } = useT();
  const styles = useStyles(createStyles);
  const top = useMemo(() => {
    const heaviest = heaviestCompletedSet(entry.sets);
    return heaviest === null ? null : weightRepsView(heaviest);
  }, [entry.sets]);
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
      entry.sets.map((set: StrengthSet, index) => {
        const { reps, weightKg } = weightRepsView(set);
        const noted = notedRpe(set);
        const rpe = noted === null ? '' : trimNumber(noted, 1);
        return {
          key: `${set.index}-${index}`,
          number: index + 1,
          completed: set.completed,
          weight: weightKg === 0 ? t('activity.bodyweightShort') : formatWeight(weightKg, units),
          reps,
          rpe,
          oneRepMax: oneRepMaxLabel(set, units),
          accessibilityLabel: set.completed
            ? joinMiddleDot([
                t('activity.setNumber', { n: index + 1 }),
                weightKg === 0 ? t('activity.bodyweight') : formatWeight(weightKg, units),
                `${reps} ${t('activity.repWord', { count: reps })}`,
                ...(rpe === '' ? [] : [t('activity.rpeValue', { value: rpe })]),
              ])
            : t('activity.setNotDone', { n: index + 1 }),
        };
      }),
    [entry.sets, t, units],
  );
  const hasRpe = useMemo(() => entry.sets.some(set => notedRpe(set) !== null), [entry.sets]);
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
    derived: { meta, tags, sets, badge, headStyle, weightColumn, hasSets: planned > 0, hasRpe },
    effects: { open },
  };
}
