import { useCallback, useMemo } from 'react';
import { exerciseTags, type Tag } from '@/features/core/design-system';
import {
  type UnitSystem,
  weightDisplayValue,
  weightFromDisplayValue,
  weightStep,
  weightUnit,
} from '@/features/core/utils';
import type { ExerciseSnapshot } from '@/features/exercises';
import type { ItemTarget } from '@/features/routines/domain/entities/ItemTarget';
import type { RoutineItem } from '@/features/routines/domain/schemas/RoutineSchema';
import { removeSet, resizeSets, withSet } from '@/features/routines/domain/utils/itemTargets';
import { itemMeta } from '@/features/routines/mappers/itemMeta';
import { ITEM_BOUNDS } from '@/features/watch-bridge';

/** One set row as the editor draws it: weight already in the user's unit, no target RPE as 0. */
export type SetRowValues = {
  readonly key: string;
  readonly index: number;
  readonly reps: number;
  readonly weight: number;
  readonly rpe: number;
};

/**
 * One item's targets in the user's unit. Weight is converted exactly once, on the way out in the
 * change that writes: converting on the way in as well is how a field reads 135 while the stepper
 * steps kilograms. Each set is its own row: reps, weight and target RPE write that set alone, a
 * set added copies the last one, and rest is one value for the whole item.
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

  const { sets } = item;
  const rows = useMemo<SetRowValues[]>(
    () =>
      sets.map(set => ({
        key: `set-${set.index}`,
        index: set.index,
        reps: set.reps,
        weight: weightDisplayValue(set.weightKg, units, step),
        rpe: set.targetRpe ?? 0,
      })),
    [sets, step, units],
  );

  const addSet = useCallback(() => {
    if (sets.length >= ITEM_BOUNDS.sets.max) return;
    onChange({ sets: resizeSets(sets, sets.length + 1) });
  }, [onChange, sets]);
  const removeSetAt = useCallback(
    (index: number) => {
      if (sets.length <= ITEM_BOUNDS.sets.min) return;
      onChange({ sets: removeSet(sets, index) });
    },
    [onChange, sets],
  );
  const setReps = useCallback(
    (index: number, reps: number) => onChange({ sets: withSet(sets, index, { reps }) }),
    [onChange, sets],
  );
  const setWeight = useCallback(
    (index: number, shown: number) =>
      onChange({ sets: withSet(sets, index, { weightKg: weightFromDisplayValue(shown, units) }) }),
    [onChange, sets, units],
  );
  const setRpe = useCallback(
    (index: number, rpe: number) => onChange({ sets: withSet(sets, index, { targetRpe: rpe === 0 ? null : rpe }) }),
    [onChange, sets],
  );
  const setRest = useCallback((restSeconds: number) => onChange({ restSeconds }), [onChange]);
  const setNotes = useCallback((notes: string | null) => onChange({ notes }), [onChange]);

  return {
    derived: {
      meta,
      libraryTags,
      rows,
      canAddSet: sets.length < ITEM_BOUNDS.sets.max,
      canRemoveSet: sets.length > ITEM_BOUNDS.sets.min,
      reps: ITEM_BOUNDS.reps,
      rpe: ITEM_BOUNDS.rpe,
      rest: ITEM_BOUNDS.restSeconds,
      weightStep: step,
      weightMax: units === 'imperial' ? 1000 : ITEM_BOUNDS.weightKg.max,
      unit: weightUnit(units),
      zeroRest: item.restSeconds === 0,
    },
    effects: { addSet, removeSet: removeSetAt, setReps, setWeight, setRpe, setRest, setNotes },
  };
}
