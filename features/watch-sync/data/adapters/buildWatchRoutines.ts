import { clamp, type UnitSystem } from '@/features/core/utils';
import type { Routine, RoutineSet } from '@/features/routines';
import {
  IMPORT_LIMITS,
  ITEM_BOUNDS,
  WATCH_FORMAT_VERSION,
  WATCH_ROUTINES_FORMAT,
  type WatchRoutinesDocument,
} from '@/features/watch-bridge';

type WatchRoutineSet = WatchRoutinesDocument['routines'][number]['items'][number]['sets'][number];

/** What an item with no set row goes out as: the routine editor's opening set. */
const FALLBACK_SET: WatchRoutineSet = { reps: 8, weightKg: 0, targetRpe: null };

const clampTo = (value: number, range: { min: number; max: number }) =>
  Number.isFinite(value) ? clamp(value, range.min, range.max) : range.min;

function watchSets(sets: readonly RoutineSet[]): WatchRoutineSet[] {
  if (sets.length === 0) return [FALLBACK_SET];
  return sets.slice(0, ITEM_BOUNDS.sets.max).map(set => ({
    reps: Math.round(clampTo(set.reps, ITEM_BOUNDS.reps)),
    weightKg: clampTo(set.weightKg, ITEM_BOUNDS.weightKg),
    targetRpe: set.targetRpe === null ? null : clampTo(set.targetRpe, ITEM_BOUNDS.rpe),
  }));
}

/**
 * The routine snapshot the phone sends to the watch. Values are clamped to `ITEM_BOUNDS` and the
 * lists cut to `IMPORT_LIMITS` on the way out, because the watch rejects a snapshot that breaks
 * them: one out-of-range row written by an older build must not cost the user every routine on
 * their wrist. Every set goes out with its own reps, weight and target RPE, in order.
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
      items: routine.items.slice(0, IMPORT_LIMITS.itemsPerRoutine).map(item => ({
        id: item.id,
        exerciseId: item.exerciseId,
        exerciseName: item.exerciseName,
        sets: watchSets(item.sets),
        restSeconds: Math.round(clampTo(item.restSeconds, ITEM_BOUNDS.restSeconds)),
        notes: item.notes === null ? null : item.notes.slice(0, ITEM_BOUNDS.notesLength),
      })),
    })),
  };
}
