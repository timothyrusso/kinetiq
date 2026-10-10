import type { ItemPatch, ItemTarget } from '@/features/routines/domain/entities/ItemTarget';
import type {
  DurationRoutineSet,
  ItemFields,
  RepsOnlyRoutineSet,
  RoutineItem,
  RoutineSet,
  TrackingType,
  WeightRepsRoutineSet,
} from '@/features/routines/domain/schemas/RoutineSchema';

/** The reps a new set counted in reps opens with, loaded or not. */
const NEW_SET_REPS = 8;

/** The load a new loaded set opens with: bodyweight. */
const NEW_SET_WEIGHT_KG = 0;

/** The time a new timed set opens with, in seconds. */
const NEW_SET_DURATION_SECONDS = 30;

/** How many sets a newly added exercise plans. */
const NEW_ITEM_SET_COUNT = 3;

/** What a planned set keeps whatever its type: its place and its effort target. */
type SetBase = Pick<RoutineSet, 'index' | 'targetRpe'>;

/** A set of `type` on `base`, with `reps` when the type counts reps and the type's defaults otherwise. */
function setOn(base: SetBase, type: TrackingType, reps: number | null): RoutineSet {
  switch (type) {
    case 'weightReps':
      return { type, ...base, reps: reps ?? NEW_SET_REPS, weightKg: NEW_SET_WEIGHT_KG };
    case 'repsOnly':
      return { type, ...base, reps: reps ?? NEW_SET_REPS };
    case 'duration':
      return { type, ...base, durationSeconds: NEW_SET_DURATION_SECONDS };
  }
}

/** A planned set of `type` at `index`, on that type's defaults: 8 reps at bodyweight, 8 reps, or 30 s. */
export function newRoutineSet(type: TrackingType, index: number): RoutineSet {
  return setOn({ index, targetRpe: null }, type, null);
}

/** `count` loaded sets of `reps` at `weightKg`, numbered from 0, with no effort target. */
export function uniformSets(count: number, reps: number, weightKg: number): WeightRepsRoutineSet[] {
  return Array.from({ length: Math.max(1, count) }, (_, index) => ({
    type: 'weightReps',
    index,
    reps,
    weightKg,
    targetRpe: null,
  }));
}

/**
 * `set` as a set of `type`, by the rules a workout changes a set's type with: reps carry between
 * the two types that count them and the weight is dropped; a set changing to or from a timed one
 * opens on the new type's defaults. Its place and effort target are kept.
 */
export function routineSetAs(set: RoutineSet, type: TrackingType): RoutineSet {
  if (set.type === type) return set;
  const base = { index: set.index, targetRpe: set.targetRpe };
  return setOn(base, type, set.type === 'duration' || type === 'duration' ? null : set.reps);
}

const isWeightReps = (set: RoutineSet): set is WeightRepsRoutineSet => set.type === 'weightReps';
const isRepsOnly = (set: RoutineSet): set is RepsOnlyRoutineSet => set.type === 'repsOnly';
const isDuration = (set: RoutineSet): set is DurationRoutineSet => set.type === 'duration';

/**
 * An item of `type` from its shared fields and `sets`. A set of another type is left out, so a
 * built item always decodes: callers pass sets they made for the type.
 */
export function routineItemOf(fields: ItemFields, type: TrackingType, sets: readonly RoutineSet[]): RoutineItem {
  switch (type) {
    case 'weightReps':
      return { ...fields, trackingType: type, sets: sets.filter(isWeightReps) };
    case 'repsOnly':
      return { ...fields, trackingType: type, sets: sets.filter(isRepsOnly) };
    case 'duration':
      return { ...fields, trackingType: type, sets: sets.filter(isDuration) };
  }
}

/** The change that makes `item` a `type` item, every set carried over by `routineSetAs`. */
export function itemAs(item: RoutineItem, type: TrackingType): ItemPatch {
  if (item.trackingType === type) return {};
  return { trackingType: type, sets: item.sets.map(set => routineSetAs(set, type)) };
}

/** `item` with `patch` applied: the targets it names change, the others stay. */
export function patchItem(item: RoutineItem, patch: ItemPatch): RoutineItem {
  const { trackingType, sets, ...fields } = item;
  return routineItemOf(
    {
      ...fields,
      ...(patch.restSeconds === undefined ? {} : { restSeconds: patch.restSeconds }),
      ...('notes' in patch ? { notes: patch.notes ?? null } : {}),
    },
    patch.trackingType ?? trackingType,
    patch.sets ?? sets,
  );
}

/**
 * `patch` as it is written to `item`: a patch touching the sets or the type names both, as the
 * item has them once patched, so the stored sets always match the stored type.
 */
export function itemWrite(item: RoutineItem, patch: ItemPatch): ItemPatch {
  if (patch.sets === undefined && patch.trackingType === undefined) return patch;
  const next = patchItem(item, patch);
  return { ...patch, trackingType: next.trackingType, sets: next.sets };
}

/**
 * `sets` cut or grown to `count` (at least one): a set added copies the last one, so a longer
 * item keeps the load it had, or opens on the defaults of `type` when there is none.
 */
export function resizeSets(sets: readonly RoutineSet[], count: number, type: TrackingType): RoutineSet[] {
  const target = Math.max(1, count);
  const last = sets.at(-1) ?? newRoutineSet(type, 0);
  return Array.from({ length: target }, (_, index) => ({ ...(sets[index] ?? last), index }));
}

/** The values an edit may give one set; a value the set's type does not record is ignored. */
export interface SetValues {
  readonly reps?: number;
  readonly weightKg?: number;
  readonly durationSeconds?: number;
  readonly targetRpe?: number | null;
}

function withValues(set: RoutineSet, values: SetValues): RoutineSet {
  const targetRpe = values.targetRpe === undefined ? set.targetRpe : values.targetRpe;
  switch (set.type) {
    case 'weightReps':
      return { ...set, targetRpe, reps: values.reps ?? set.reps, weightKg: values.weightKg ?? set.weightKg };
    case 'repsOnly':
      return { ...set, targetRpe, reps: values.reps ?? set.reps };
    case 'duration':
      return { ...set, targetRpe, durationSeconds: values.durationSeconds ?? set.durationSeconds };
  }
}

/** `sets` with `values` applied to the set at `index` only. */
export function withSet(sets: readonly RoutineSet[], index: number, values: SetValues): RoutineSet[] {
  return sets.map(set => (set.index === index ? withValues(set, values) : set));
}

/** `sets` without the set at `index`, renumbered from 0; the last set stays. */
export function removeSet(sets: readonly RoutineSet[], index: number): RoutineSet[] {
  if (sets.length <= 1) return [...sets];
  return sets.filter(set => set.index !== index).map((set, at) => (set.index === at ? set : { ...set, index: at }));
}

/**
 * The opening plan for a newly added exercise of `type`: 3 sets on that type's defaults (8 reps
 * at bodyweight, 8 reps, or 30 s), resting for the user's default.
 */
export function defaultItemTarget(type: TrackingType, defaultRestSeconds: number): ItemTarget {
  const sets = Array.from({ length: NEW_ITEM_SET_COUNT }, (_, index) => newRoutineSet(type, index));
  const {
    id: _id,
    exerciseId: _exerciseId,
    exerciseName: _name,
    ...target
  } = routineItemOf(
    { id: '', exerciseId: '', exerciseName: '', restSeconds: defaultRestSeconds, notes: null },
    type,
    sets,
  );
  return target;
}
