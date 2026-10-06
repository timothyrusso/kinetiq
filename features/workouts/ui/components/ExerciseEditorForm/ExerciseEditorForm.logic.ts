import { useCallback, useMemo } from 'react';
import { useT } from '@/features/core/translations';
import {
  type UnitSystem,
  weightDisplayValue,
  weightFromDisplayValue,
  weightStep,
  weightUnit,
} from '@/features/core/utils';
import { TRACKING_TYPE_LABEL, TRACKING_TYPES } from '@/features/exercises';
import { ITEM_BOUNDS } from '@/features/watch-bridge';
import type { StrengthEntry, StrengthSet, TrackingType } from '@/features/workouts/domain/schemas/StrengthEntrySchema';
import type { EntryPatch, SetPatch } from '@/features/workouts/domain/utils/sessionTransitions';
import { isTypeLocked } from '@/features/workouts/domain/utils/trackingSets';
import { entryMeta } from '@/features/workouts/mappers/entryMeta';

/** What every set row draws, whatever its type: weight already in the user's unit, no RPE as 0. */
type RowBase = {
  readonly key: string;
  readonly index: number;
  readonly rpe: number;
  readonly completed: boolean;
};

/** One set row as the editor draws it, in what the set's type records. */
export type ExerciseSetRow = RowBase &
  (
    | { readonly type: 'weightReps'; readonly reps: number; readonly weight: number }
    | { readonly type: 'repsOnly'; readonly reps: number }
    | { readonly type: 'duration'; readonly durationSeconds: number }
  );

export interface ExerciseEditorWriters {
  readonly onChangeSet: (setIndex: number, patch: SetPatch) => void;
  readonly onAddSet: () => void;
  readonly onRemoveSet: (setIndex: number) => void;
  readonly onChangeEntry: (patch: EntryPatch) => void;
  readonly onChangeType: (type: TrackingType) => void;
}

function rowOf(set: StrengthSet, units: UnitSystem, step: number): ExerciseSetRow {
  const base = { key: `set-${set.index}`, index: set.index, rpe: set.rpe ?? 0, completed: set.completed };
  switch (set.type) {
    case 'weightReps':
      return { ...base, type: set.type, reps: set.reps, weight: weightDisplayValue(set.weightKg, units, step) };
    case 'repsOnly':
      return { ...base, type: set.type, reps: set.reps };
    case 'duration':
      return { ...base, type: set.type, durationSeconds: set.durationSeconds };
  }
}

/**
 * One exercise of the workout in its user's unit, laid out like a routine item: what each set
 * records, every set its own row of that type, a set added copying the last, rest and note for the
 * whole exercise. Weight converts on the way out only, and an RPE of 0 is "not recorded". The
 * bounds are the routine item's, so a workout written back into its routine never holds a value
 * the routine editor could not. The type stays changeable until a set is done (`isTypeLocked`).
 */
export function useExerciseEditorFormLogic(entry: StrengthEntry, units: UnitSystem, writers: ExerciseEditorWriters) {
  const { onChangeSet, onAddSet, onRemoveSet, onChangeEntry, onChangeType } = writers;
  const { t } = useT();
  const step = weightStep(units);
  const meta = useMemo(() => entryMeta(entry, units), [entry, units]);
  const typeSegments = useMemo(
    () => TRACKING_TYPES.map(type => ({ value: type, label: t(TRACKING_TYPE_LABEL[type]) })),
    [t],
  );

  const { sets } = entry;
  const rows = useMemo<ExerciseSetRow[]>(() => sets.map(set => rowOf(set, units, step)), [sets, step, units]);
  const typeLocked = isTypeLocked(entry);

  const canAddSet = sets.length < ITEM_BOUNDS.sets.max;
  const addSet = useCallback(() => {
    if (canAddSet) onAddSet();
  }, [canAddSet, onAddSet]);
  const setReps = useCallback((index: number, reps: number) => onChangeSet(index, { reps }), [onChangeSet]);
  const setWeight = useCallback(
    (index: number, shown: number) => onChangeSet(index, { weightKg: weightFromDisplayValue(shown, units) }),
    [onChangeSet, units],
  );
  const setDuration = useCallback(
    (index: number, durationSeconds: number) => onChangeSet(index, { durationSeconds }),
    [onChangeSet],
  );
  const setRpe = useCallback(
    (index: number, rpe: number) => onChangeSet(index, { rpe: rpe === 0 ? null : rpe }),
    [onChangeSet],
  );
  const setRest = useCallback((restSeconds: number) => onChangeEntry({ restSeconds }), [onChangeEntry]);
  const setNotes = useCallback((notes: string | null) => onChangeEntry({ notes }), [onChangeEntry]);
  const changeType = useCallback(
    (type: TrackingType) => {
      if (!typeLocked && type !== entry.trackingType) onChangeType(type);
    },
    [entry.trackingType, onChangeType, typeLocked],
  );

  return {
    derived: {
      meta,
      rows,
      trackingType: entry.trackingType,
      typeSegments,
      typeLocked,
      canAddSet,
      // NOTE: the session keeps an exercise's last set; the button says so before the store does.
      canRemoveSet: sets.length > ITEM_BOUNDS.sets.min,
      reps: ITEM_BOUNDS.reps,
      duration: ITEM_BOUNDS.durationSeconds,
      rpe: ITEM_BOUNDS.rpe,
      rest: ITEM_BOUNDS.restSeconds,
      weightStep: step,
      weightMax: units === 'imperial' ? 1000 : ITEM_BOUNDS.weightKg.max,
      unit: weightUnit(units),
      zeroRest: entry.restSeconds === 0,
      noteMax: ITEM_BOUNDS.notesLength,
    },
    effects: { addSet, removeSet: onRemoveSet, setReps, setWeight, setDuration, setRpe, setRest, setNotes, changeType },
  };
}
