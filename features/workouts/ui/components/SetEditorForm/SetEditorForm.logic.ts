import { useCallback, useMemo } from 'react';
import type { MetaItem } from '@/features/core/design-system';
import { useT } from '@/features/core/translations';
import { type UnitSystem, weightDisplayValue, weightFromDisplayValue, weightStep } from '@/features/core/utils';
import type { StrengthEntry, StrengthSet } from '@/features/workouts/domain/schemas/StrengthEntrySchema';
import type { SetPatch } from '@/features/workouts/domain/utils/sessionTransitions';

/** The heaviest load the weight stepper reaches, per unit system. */
const MAX_WEIGHT = { metric: 450, imperial: 1000 } as const;

/**
 * The editor's values in the user's units and the three writers. Weight converts on the way out
 * only, and landing on 0 is a deliberate bodyweight; an RPE of 0 means "not recorded".
 */
export function useSetEditorFormLogic(
  entry: StrengthEntry,
  set: StrengthSet,
  units: UnitSystem,
  onChange: (patch: SetPatch) => void,
) {
  const { t } = useT();
  const step = weightStep(units);
  const context = useMemo<MetaItem[]>(
    () => [
      { icon: 'dumbbell', label: entry.exerciseName },
      { icon: 'layers', label: t('workoutFlow.repCount', { count: set.reps }) },
    ],
    [entry.exerciseName, set.reps, t],
  );
  const changeReps = useCallback((reps: number) => onChange({ reps }), [onChange]);
  const changeWeight = useCallback(
    (value: number) => onChange({ weightKg: weightFromDisplayValue(value, units) }),
    [onChange, units],
  );
  const changeRpe = useCallback((rpe: number) => onChange({ rpe: rpe === 0 ? null : rpe }), [onChange]);
  return {
    derived: {
      context,
      step,
      displayWeight: weightDisplayValue(set.weightKg, units, step),
      maxWeight: MAX_WEIGHT[units],
      rpe: set.rpe ?? 0,
    },
    effects: { changeReps, changeWeight, changeRpe },
  };
}
