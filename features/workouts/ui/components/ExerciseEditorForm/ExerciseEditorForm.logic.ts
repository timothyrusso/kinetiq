import { useCallback, useMemo } from 'react';
import {
  type UnitSystem,
  weightDisplayValue,
  weightFromDisplayValue,
  weightStep,
  weightUnit,
} from '@/features/core/utils';
import { ITEM_BOUNDS } from '@/features/watch-bridge';
import type { StrengthEntry } from '@/features/workouts/domain/schemas/StrengthEntrySchema';
import type { EntryPatch, SetPatch } from '@/features/workouts/domain/utils/sessionTransitions';
import { entryMeta } from '@/features/workouts/mappers/entryMeta';

/** One set row as the editor draws it: weight already in the user's unit, no RPE as 0. */
export type ExerciseSetRow = {
  readonly key: string;
  readonly index: number;
  readonly reps: number;
  readonly weight: number;
  readonly rpe: number;
  readonly completed: boolean;
};

export interface ExerciseEditorWriters {
  readonly onChangeSet: (setIndex: number, patch: SetPatch) => void;
  readonly onAddSet: () => void;
  readonly onRemoveSet: (setIndex: number) => void;
  readonly onChangeEntry: (patch: EntryPatch) => void;
}

/**
 * One exercise of the workout in its user's unit, laid out like a routine item: every set its
 * own row, a set added copying the last, rest and note for the whole exercise. Weight converts on
 * the way out only, and an RPE of 0 is "not recorded". The bounds are the routine item's, so a
 * workout written back into its routine never holds a value the routine editor could not.
 */
export function useExerciseEditorFormLogic(entry: StrengthEntry, units: UnitSystem, writers: ExerciseEditorWriters) {
  const { onChangeSet, onAddSet, onRemoveSet, onChangeEntry } = writers;
  const step = weightStep(units);
  const meta = useMemo(() => entryMeta(entry, units), [entry, units]);

  const { sets } = entry;
  const rows = useMemo<ExerciseSetRow[]>(
    () =>
      sets.map(set => ({
        key: `set-${set.index}`,
        index: set.index,
        reps: set.reps,
        weight: weightDisplayValue(set.weightKg, units, step),
        rpe: set.rpe ?? 0,
        completed: set.completed,
      })),
    [sets, step, units],
  );

  const canAddSet = sets.length < ITEM_BOUNDS.sets.max;
  const addSet = useCallback(() => {
    if (canAddSet) onAddSet();
  }, [canAddSet, onAddSet]);
  const setReps = useCallback((index: number, reps: number) => onChangeSet(index, { reps }), [onChangeSet]);
  const setWeight = useCallback(
    (index: number, shown: number) => onChangeSet(index, { weightKg: weightFromDisplayValue(shown, units) }),
    [onChangeSet, units],
  );
  const setRpe = useCallback(
    (index: number, rpe: number) => onChangeSet(index, { rpe: rpe === 0 ? null : rpe }),
    [onChangeSet],
  );
  const setRest = useCallback((restSeconds: number) => onChangeEntry({ restSeconds }), [onChangeEntry]);
  const setNotes = useCallback((notes: string | null) => onChangeEntry({ notes }), [onChangeEntry]);

  return {
    derived: {
      meta,
      rows,
      canAddSet,
      // NOTE: the session keeps an exercise's last set; the button says so before the store does.
      canRemoveSet: sets.length > ITEM_BOUNDS.sets.min,
      reps: ITEM_BOUNDS.reps,
      rpe: ITEM_BOUNDS.rpe,
      rest: ITEM_BOUNDS.restSeconds,
      weightStep: step,
      weightMax: units === 'imperial' ? 1000 : ITEM_BOUNDS.weightKg.max,
      unit: weightUnit(units),
      zeroRest: entry.restSeconds === 0,
      noteMax: ITEM_BOUNDS.notesLength,
    },
    effects: { addSet, removeSet: onRemoveSet, setReps, setWeight, setRpe, setRest, setNotes },
  };
}
