import { useCallback, useMemo } from 'react';
import type { PressableStateCallbackType, StyleProp, ViewStyle } from 'react-native';
import { type MetaItem, type Tag, useStyles } from '@/features/core/design-system';
import { type TKey, type TVars, useT } from '@/features/core/translations';
import { formatTimer, formatWeight, joinMiddleDot, trimNumber, type UnitSystem } from '@/features/core/utils';
import type { StrengthEntry, StrengthSet, WeightRepsSet } from '@/features/workouts/domain/schemas/StrengthEntrySchema';
import { setEstimate } from '@/features/workouts/domain/utils/oneRepMax';
import { createStyles } from '@/features/workouts/ui/components/ActivityExerciseCard/ActivityExerciseCard.style';

type Translate = (key: TKey, vars?: TVars) => string;

/** The table's head: a weight column for a loaded exercise, the value column, and the estimate. */
interface Columns {
  readonly weight: TKey | null;
  readonly value: TKey;
  readonly estimate: boolean;
}

/**
 * The completed set with the highest `score`, or `null` when nothing was completed. The first one
 * wins a tie.
 */
function bestCompleted<S extends StrengthSet>(sets: readonly S[], score: (set: S) => number): S | null {
  let best: S | null = null;
  let bestScore = -1;
  for (const set of sets) {
    if (!set.completed) continue;
    const value = score(set);
    if (value > bestScore) {
      best = set;
      bestScore = value;
    }
  }
  return best;
}

/** The heaviest completed loaded set by estimated max; the recompute covers rows written without one. */
const heaviestScore = (set: WeightRepsSet) => setEstimate(set) ?? set.weightKg;

/** The exercise's best completed set, in its own terms: the heaviest, the most reps, the longest. */
function topSetLabel(entry: StrengthEntry, units: UnitSystem, t: Translate): string | null {
  switch (entry.trackingType) {
    case 'weightReps': {
      const top = bestCompleted(entry.sets, heaviestScore);
      if (top === null) return null;
      return t('activity.topSet', {
        weight: top.weightKg === 0 ? t('activity.bodyweightShort') : formatWeight(top.weightKg, units),
        reps: top.reps,
      });
    }
    case 'repsOnly': {
      const top = bestCompleted(entry.sets, set => set.reps);
      return top === null ? null : t('tracking.topReps', { reps: top.reps });
    }
    case 'duration': {
      const top = bestCompleted(entry.sets, set => set.durationSeconds);
      return top === null ? null : t('tracking.topTime', { time: formatTimer(top.durationSeconds) });
    }
  }
}

function columnsOf(entry: StrengthEntry, units: UnitSystem): Columns {
  switch (entry.trackingType) {
    case 'weightReps':
      return {
        weight: units === 'metric' ? 'activity.colKg' : 'activity.colLb',
        value: 'activity.colReps',
        estimate: true,
      };
    case 'repsOnly':
      return { weight: null, value: 'activity.colReps', estimate: false };
    case 'duration':
      return { weight: null, value: 'tracking.colTime', estimate: false };
  }
}

/**
 * A set's estimated ceiling, or a dash: there is none for bodyweight work or past 15 reps, where
 * Epley extrapolates, and an invented ceiling over 25 bodyweight reps is the number to avoid.
 */
function oneRepMaxLabel(set: WeightRepsSet, units: UnitSystem): string {
  if (!set.completed) return '-';
  const max = setEstimate(set);
  return max === null ? '-' : formatWeight(max, units);
}

/**
 * The effort noted on a completed set, or `null`: the set sheet stores 0 as null, and a set not
 * done carries only the routine's target, which is not what was felt.
 */
function notedRpe(set: StrengthSet): number | null {
  return set.completed && set.rpe !== null && set.rpe > 0 ? set.rpe : null;
}

/** One row of the table: the set's weight (loaded sets only), its value and its estimate, and what is spoken. */
function setRow(set: StrengthSet, index: number, units: UnitSystem, t: Translate) {
  const noted = notedRpe(set);
  const rpe = noted === null ? '' : trimNumber(noted, 1);
  const base = { key: `${set.index}-${index}`, number: index + 1, completed: set.completed, rpe };
  const spoken = (facts: readonly string[]) =>
    set.completed
      ? joinMiddleDot([
          t('activity.setNumber', { n: index + 1 }),
          ...facts,
          ...(rpe === '' ? [] : [t('activity.rpeValue', { value: rpe })]),
        ])
      : t('activity.setNotDone', { n: index + 1 });
  switch (set.type) {
    case 'weightReps': {
      const reps = `${set.reps} ${t('activity.repWord', { count: set.reps })}`;
      return {
        ...base,
        weight: set.weightKg === 0 ? t('activity.bodyweightShort') : formatWeight(set.weightKg, units),
        value: String(set.reps),
        oneRepMax: oneRepMaxLabel(set, units),
        accessibilityLabel: spoken([
          set.weightKg === 0 ? t('activity.bodyweight') : formatWeight(set.weightKg, units),
          reps,
        ]),
      };
    }
    case 'repsOnly':
      return {
        ...base,
        weight: null,
        value: String(set.reps),
        oneRepMax: null,
        accessibilityLabel: spoken([`${set.reps} ${t('activity.repWord', { count: set.reps })}`]),
      };
    case 'duration': {
      const time = formatTimer(set.durationSeconds);
      return { ...base, weight: null, value: time, oneRepMax: null, accessibilityLabel: spoken([time]) };
    }
  }
}

/**
 * One exercise's badge, facts and set rows, in what its type recorded, and the press that opens
 * the exercise. A loaded exercise's table has weight, reps and the estimated max; a reps-only one
 * its reps; a timed one its time per set.
 */
export function useActivityExerciseCardLogic(
  entry: StrengthEntry,
  units: UnitSystem,
  onOpen: (exerciseId: string) => void,
) {
  const { t } = useT();
  const styles = useStyles(createStyles);
  const done = entry.sets.filter(set => set.completed).length;
  const planned = entry.sets.length;
  const meta = useMemo<MetaItem[]>(() => {
    const top = topSetLabel(entry, units, t);
    return [
      { icon: 'layers', label: `${done}/${planned} ${t('activity.setWord', { count: planned })}` },
      ...(top === null ? [] : [{ icon: 'trophy' as const, label: top }]),
    ];
  }, [done, entry, planned, t, units]);
  const tags = useMemo<Tag[]>(
    () => (entry.muscleGroup ? [{ key: 'muscle', label: entry.muscleGroup }] : []),
    [entry.muscleGroup],
  );
  const sets = useMemo(
    () => entry.sets.map((set: StrengthSet, index) => setRow(set, index, units, t)),
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
  const columns = useMemo(() => columnsOf(entry, units), [entry, units]);
  return {
    derived: { meta, tags, sets, badge, headStyle, columns, hasSets: planned > 0, hasRpe },
    effects: { open },
  };
}
