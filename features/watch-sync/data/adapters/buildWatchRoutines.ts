import { clamp, type UnitSystem } from '@/features/core/utils';
import { defaultItemTarget, type Routine, type RoutineItem, routineItemOf } from '@/features/routines';
import {
  IMPORT_LIMITS,
  ITEM_BOUNDS,
  WATCH_FORMAT_VERSION,
  WATCH_ROUTINES_FORMAT,
  type WatchRoutinesDocument,
} from '@/features/watch-bridge';

type WatchRoutineItem = WatchRoutinesDocument['routines'][number]['items'][number];

type Range = { readonly min: number; readonly max: number };

const clampTo = (value: number, range: Range) =>
  Number.isFinite(value) ? clamp(value, range.min, range.max) : range.min;

const wholeIn = (value: number, range: Range) => Math.round(clampTo(value, range));

const targetRpeOf = (target: number | null) => (target === null ? null : clampTo(target, ITEM_BOUNDS.rpe));

/** `item` as it is planned, or, with no set row, with the routine editor's opening set of its type. */
function withPlannedSets(item: RoutineItem): RoutineItem {
  if (item.sets.length > 0) return item;
  const { trackingType, sets: _none, ...fields } = item;
  const opening = defaultItemTarget(trackingType, item.restSeconds).sets.slice(0, 1);
  return routineItemOf(fields, trackingType, opening);
}

/** One item on the wire: its tracking type, and each set with its own type and only its own values. */
function watchItem(routineItem: RoutineItem): WatchRoutineItem {
  const item = withPlannedSets(routineItem);
  const fields = {
    id: item.id,
    exerciseId: item.exerciseId,
    exerciseName: item.exerciseName,
    restSeconds: wholeIn(item.restSeconds, ITEM_BOUNDS.restSeconds),
    notes: item.notes === null ? null : item.notes.slice(0, ITEM_BOUNDS.notesLength),
  };
  switch (item.trackingType) {
    case 'weightReps':
      return {
        ...fields,
        trackingType: item.trackingType,
        sets: item.sets.slice(0, ITEM_BOUNDS.sets.max).map(set => ({
          type: set.type,
          reps: wholeIn(set.reps, ITEM_BOUNDS.reps),
          weightKg: clampTo(set.weightKg, ITEM_BOUNDS.weightKg),
          targetRpe: targetRpeOf(set.targetRpe),
        })),
      };
    case 'repsOnly':
      return {
        ...fields,
        trackingType: item.trackingType,
        sets: item.sets.slice(0, ITEM_BOUNDS.sets.max).map(set => ({
          type: set.type,
          reps: wholeIn(set.reps, ITEM_BOUNDS.reps),
          targetRpe: targetRpeOf(set.targetRpe),
        })),
      };
    case 'duration':
      return {
        ...fields,
        trackingType: item.trackingType,
        sets: item.sets.slice(0, ITEM_BOUNDS.sets.max).map(set => ({
          type: set.type,
          durationSeconds: wholeIn(set.durationSeconds, ITEM_BOUNDS.durationSeconds),
          targetRpe: targetRpeOf(set.targetRpe),
        })),
      };
  }
}

/**
 * The routine snapshot the phone sends to the watch. Values are clamped to `ITEM_BOUNDS` and the
 * lists cut to `IMPORT_LIMITS` on the way out, because the watch rejects a snapshot that breaks
 * them: one out-of-range row written by an older build must not cost the user every routine on
 * their wrist. Every item goes out with its tracking type, and every set with its own type and
 * values, in order.
 */
export function buildWatchRoutines(
  routines: readonly Routine[],
  unitSystem: UnitSystem,
  exportedAt: Date,
): WatchRoutinesDocument {
  return {
    format: WATCH_ROUTINES_FORMAT,
    version: WATCH_FORMAT_VERSION,
    exportedAt: exportedAt.toISOString(),
    unitSystem,
    routines: routines.slice(0, IMPORT_LIMITS.routines).map(routine => ({
      id: routine.id,
      name: routine.name,
      items: routine.items.slice(0, IMPORT_LIMITS.itemsPerRoutine).map(watchItem),
    })),
  };
}
