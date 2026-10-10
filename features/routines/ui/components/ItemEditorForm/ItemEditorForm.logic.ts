import { useCallback, useMemo } from 'react';
import { exerciseLibraryTags, type Tag } from '@/features/core/design-system';
import { useT } from '@/features/core/translations';
import {
  type UnitSystem,
  weightDisplayValue,
  weightFromDisplayValue,
  weightStep,
  weightUnit,
} from '@/features/core/utils';
import { type ExerciseSnapshot, TRACKING_TYPE_LABEL, TRACKING_TYPES } from '@/features/exercises';
import type { ItemChange } from '@/features/routines/domain/entities/ItemTarget';
import type { RoutineItem, RoutineSet, TrackingType } from '@/features/routines/domain/schemas/RoutineSchema';
import { removeSet, resizeSets, withSet } from '@/features/routines/domain/utils/itemTargets';
import { itemMeta } from '@/features/routines/mappers/itemMeta';
import { ITEM_BOUNDS } from '@/features/watch-bridge';

/** What every set row draws, whatever its type: no target RPE as 0. */
type RowBase = { readonly key: string; readonly index: number; readonly rpe: number };

/** One set row as the editor draws it, in what the set's type records, weight in the user's unit. */
export type SetRowValues = RowBase &
  (
    | { readonly type: 'weightReps'; readonly reps: number; readonly weight: number }
    | { readonly type: 'repsOnly'; readonly reps: number }
    | { readonly type: 'duration'; readonly durationSeconds: number }
  );

function rowOf(set: RoutineSet, units: UnitSystem, step: number): SetRowValues {
  const base = { key: `set-${set.index}`, index: set.index, rpe: set.targetRpe ?? 0 };
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
 * One item's targets in the user's unit. Weight is converted exactly once, on the way out in the
 * change that writes: converting on the way in as well is how a field reads 135 while the stepper
 * steps kilograms. What each set records is the item's tracking type, chosen at the top; each set
 * is its own row of that type: reps, weight, time and target RPE write that set alone, a set added
 * copies the last one, and rest is one value for the whole item. Every writer hands over an
 * `ItemChange`, applied to the item as it is when written, not to the `sets` drawn here.
 */
export function useItemEditorFormLogic(
  item: RoutineItem,
  snapshot: ExerciseSnapshot | null,
  units: UnitSystem,
  onChange: (change: ItemChange) => void,
  onChangeType: (type: TrackingType) => void,
) {
  const { t } = useT();
  const step = weightStep(units);
  const meta = useMemo(() => itemMeta(item, units), [item, units]);
  const libraryTags = useMemo<Tag[]>(() => (snapshot === null ? [] : exerciseLibraryTags(snapshot)), [snapshot]);
  const typeSegments = useMemo(
    () => TRACKING_TYPES.map(type => ({ value: type, label: t(TRACKING_TYPE_LABEL[type]) })),
    [t],
  );

  const { sets } = item;
  const rows = useMemo<SetRowValues[]>(() => sets.map(set => rowOf(set, units, step)), [sets, step, units]);

  const addSet = useCallback(() => {
    if (sets.length >= ITEM_BOUNDS.sets.max) return;
    onChange(item =>
      item.sets.length >= ITEM_BOUNDS.sets.max
        ? {}
        : { sets: resizeSets(item.sets, item.sets.length + 1, item.trackingType) },
    );
  }, [onChange, sets.length]);
  const removeSetAt = useCallback(
    (index: number) => {
      if (sets.length <= ITEM_BOUNDS.sets.min) return;
      onChange(item => (item.sets.length <= ITEM_BOUNDS.sets.min ? {} : { sets: removeSet(item.sets, index) }));
    },
    [onChange, sets.length],
  );
  const setReps = useCallback(
    (index: number, reps: number) => onChange(item => ({ sets: withSet(item.sets, index, { reps }) })),
    [onChange],
  );
  const setWeight = useCallback(
    (index: number, shown: number) =>
      onChange(item => ({ sets: withSet(item.sets, index, { weightKg: weightFromDisplayValue(shown, units) }) })),
    [onChange, units],
  );
  const setDuration = useCallback(
    (index: number, durationSeconds: number) =>
      onChange(item => ({ sets: withSet(item.sets, index, { durationSeconds }) })),
    [onChange],
  );
  const setRpe = useCallback(
    (index: number, rpe: number) =>
      onChange(item => ({ sets: withSet(item.sets, index, { targetRpe: rpe === 0 ? null : rpe }) })),
    [onChange],
  );
  const setRest = useCallback((restSeconds: number) => onChange(() => ({ restSeconds })), [onChange]);
  const setNotes = useCallback((notes: string | null) => onChange(() => ({ notes })), [onChange]);
  const changeType = useCallback(
    (type: TrackingType) => {
      if (type !== item.trackingType) onChangeType(type);
    },
    [item.trackingType, onChangeType],
  );

  return {
    derived: {
      meta,
      libraryTags,
      rows,
      trackingType: item.trackingType,
      typeSegments,
      canAddSet: sets.length < ITEM_BOUNDS.sets.max,
      canRemoveSet: sets.length > ITEM_BOUNDS.sets.min,
      reps: ITEM_BOUNDS.reps,
      duration: ITEM_BOUNDS.durationSeconds,
      rpe: ITEM_BOUNDS.rpe,
      rest: ITEM_BOUNDS.restSeconds,
      weightStep: step,
      weightMax: units === 'imperial' ? 1000 : ITEM_BOUNDS.weightKg.max,
      unit: weightUnit(units),
      zeroRest: item.restSeconds === 0,
      noteMax: ITEM_BOUNDS.notesLength,
    },
    effects: {
      addSet,
      removeSet: removeSetAt,
      setReps,
      setWeight,
      setDuration,
      setRpe,
      setRest,
      setNotes,
      changeType,
    },
  };
}
