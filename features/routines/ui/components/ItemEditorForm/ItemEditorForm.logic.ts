import { useCallback, useMemo } from 'react';
import { exerciseTags, type Tag } from '@/features/core/design-system';
import {
  repsFromRange,
  type UnitSystem,
  weightDisplayValue,
  weightFromDisplayValue,
  weightStep,
  weightUnit,
} from '@/features/core/utils';
import type { ExerciseSnapshot } from '@/features/exercises';
import type { ItemTarget } from '@/features/routines/domain/entities/ItemTarget';
import type { RoutineItem } from '@/features/routines/domain/schemas/RoutineSchema';
import { itemMeta } from '@/features/routines/mappers/itemMeta';

/**
 * One item's targets in the user's unit. Weight is converted exactly once, on the way out in the
 * change that writes: converting on the way in as well is how a field reads 135 while the stepper
 * steps kilograms.
 */
export function useItemEditorFormLogic(
  item: RoutineItem,
  snapshot: ExerciseSnapshot | null,
  units: UnitSystem,
  onChange: (patch: Partial<ItemTarget>) => void,
) {
  const step = weightStep(units);
  const meta = useMemo(() => itemMeta(item, units), [item, units]);
  const libraryTags = useMemo<Tag[]>(
    () =>
      snapshot === null
        ? []
        : [...exerciseTags(snapshot), ...snapshot.equipment.map(gear => ({ key: `e:${gear}`, label: gear }))],
    [snapshot],
  );

  const setSets = useCallback((sets: number) => onChange({ sets }), [onChange]);
  const setReps = useCallback((reps: number) => onChange({ reps: String(reps) }), [onChange]);
  const setWeight = useCallback(
    (shown: number) => onChange({ weightKg: weightFromDisplayValue(shown, units) }),
    [onChange, units],
  );
  const setRest = useCallback((restSeconds: number) => onChange({ restSeconds }), [onChange]);
  const setNotes = useCallback((notes: string | null) => onChange({ notes }), [onChange]);

  return {
    derived: {
      meta,
      libraryTags,
      reps: repsFromRange(item.reps),
      weight: weightDisplayValue(item.weightKg, units, step),
      weightStep: step,
      weightMax: units === 'imperial' ? 1000 : 450,
      unit: weightUnit(units),
      zeroRest: item.restSeconds === 0,
    },
    effects: { setSets, setReps, setWeight, setRest, setNotes },
  };
}
