import { clamp, type UnitSystem } from '@/features/core/utils';
import type { Routine } from '@/features/routines';
import {
  IMPORT_LIMITS,
  ITEM_BOUNDS,
  WATCH_FORMAT_VERSION,
  WATCH_ROUTINES_FORMAT,
  type WatchRoutinesDocument,
} from '@/features/watch-bridge';

const clampTo = (value: number, range: { min: number; max: number }) =>
  Number.isFinite(value) ? clamp(value, range.min, range.max) : range.min;

/**
 * The routine snapshot the phone sends to the watch. Values are clamped to `ITEM_BOUNDS` and the
 * lists cut to `IMPORT_LIMITS` on the way out, because the watch rejects a snapshot that breaks
 * them: one out-of-range row written by an older build must not cost the user every routine on
 * their wrist. The v1 envelope has one target per item, so an item goes out as its set count
 * with its first set's reps and weight.
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
        sets: Math.round(clampTo(item.sets.length, ITEM_BOUNDS.sets)),
        reps: `${item.sets[0]?.reps ?? 8}`.slice(0, ITEM_BOUNDS.repsLength),
        weightKg: clampTo(item.sets[0]?.weightKg ?? 0, ITEM_BOUNDS.weightKg),
        restSeconds: Math.round(clampTo(item.restSeconds, ITEM_BOUNDS.restSeconds)),
        notes: item.notes === null ? null : item.notes.slice(0, ITEM_BOUNDS.notesLength),
      })),
    })),
  };
}
