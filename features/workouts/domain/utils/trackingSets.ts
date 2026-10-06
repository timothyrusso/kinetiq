import type {
  DurationSet,
  EntryFields,
  RepsOnlySet,
  StrengthEntry,
  StrengthSet,
  TrackingType,
  WeightRepsSet,
} from '@/features/workouts/domain/schemas/StrengthEntrySchema';
import { withEstimated1rm } from '@/features/workouts/domain/utils/oneRepMax';

/** The reps a new set counted in reps opens with, loaded or not. */
const NEW_SET_REPS = 8;

/** The load a new loaded set opens with: bodyweight. */
const NEW_SET_WEIGHT_KG = 0;

/** The time a new timed set opens with, in seconds. */
const NEW_SET_DURATION_SECONDS = 30;

/** What a set keeps whatever its type: its place, whether it is done, its effort and its row. */
type SetBase = Pick<StrengthSet, 'index' | 'completed' | 'rpe' | 'routineSetIndex'>;

function baseOf(set: SetBase): SetBase {
  return {
    index: set.index,
    completed: set.completed,
    rpe: set.rpe,
    ...(set.routineSetIndex !== undefined ? { routineSetIndex: set.routineSetIndex } : {}),
  };
}

/** A set of `type` on `base`, with `reps` when the type counts reps and the type's defaults otherwise. */
function setOn(base: SetBase, type: TrackingType, reps: number | null): StrengthSet {
  switch (type) {
    case 'weightReps':
      return withEstimated1rm({
        type,
        ...base,
        reps: reps ?? NEW_SET_REPS,
        weightKg: NEW_SET_WEIGHT_KG,
        estimated1rm: null,
      });
    case 'repsOnly':
      return { type, ...base, reps: reps ?? NEW_SET_REPS };
    case 'duration':
      return { type, ...base, durationSeconds: NEW_SET_DURATION_SECONDS };
  }
}

/** An open set of `type` at `index`, on that type's defaults: 8 reps at bodyweight, 8 reps, or 30 s. */
export function newSet(type: TrackingType, index: number): StrengthSet {
  return setOn({ index, completed: false, rpe: null }, type, null);
}

/**
 * `set` as a set of `type`. Reps carry between the two types that count them and the weight is
 * dropped; a set changing to or from a timed one opens on the new type's defaults. Its place,
 * state, RPE and routine row are kept, so the finish still writes it back into its row.
 */
export function setAs(set: StrengthSet, type: TrackingType): StrengthSet {
  if (set.type === type) return set;
  return setOn(baseOf(set), type, set.type === 'duration' || type === 'duration' ? null : set.reps);
}

const isWeightReps = (set: StrengthSet): set is WeightRepsSet => set.type === 'weightReps';
const isRepsOnly = (set: StrengthSet): set is RepsOnlySet => set.type === 'repsOnly';
const isDuration = (set: StrengthSet): set is DurationSet => set.type === 'duration';

/**
 * An entry of `type` from its shared fields and `sets`. A set of another type is left out, so a
 * built entry always decodes: callers pass sets they made for the type.
 */
export function entryOf(fields: EntryFields, type: TrackingType, sets: readonly StrengthSet[]): StrengthEntry {
  switch (type) {
    case 'weightReps':
      return { ...fields, trackingType: type, sets: sets.filter(isWeightReps) };
    case 'repsOnly':
      return { ...fields, trackingType: type, sets: sets.filter(isRepsOnly) };
    case 'duration':
      return { ...fields, trackingType: type, sets: sets.filter(isDuration) };
  }
}

/** The fields of `entry` every type shares. */
export function fieldsOf({ trackingType: _type, sets: _sets, ...fields }: StrengthEntry): EntryFields {
  return fields;
}

/** `entry` with `sets` in place of its own. */
export function withSets(entry: StrengthEntry, sets: readonly StrengthSet[]): StrengthEntry {
  return entryOf(fieldsOf(entry), entry.trackingType, sets);
}

/** A completed set fixes what the exercise records: its type can no longer change. */
export function isTypeLocked(entry: Pick<StrengthEntry, 'sets'>): boolean {
  return entry.sets.some(set => set.completed);
}

/** `entry` recorded as `type`, every set carried over by `setAs`. */
export function entryAs(entry: StrengthEntry, type: TrackingType): StrengthEntry {
  if (entry.trackingType === type) return entry;
  return entryOf(
    fieldsOf(entry),
    type,
    entry.sets.map(set => setAs(set, type)),
  );
}
