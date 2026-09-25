/**
 * Builds the routine snapshot the phone sends to the watch.
 *
 * Pure, so the shape and the limits are unit tested without a device. Values are clamped to
 * `ITEM_BOUNDS` and the lists cut to `IMPORT_LIMITS` here, on the way out, because the watch
 * rejects a snapshot that breaks them (Stability rule 3): one out-of-range row written by an
 * older build must not cost the user every routine on their wrist.
 */
import type { Routine } from '@/domain/types';
import { IMPORT_LIMITS, ITEM_BOUNDS } from '@/transfer/format';
import type { UnitSystem } from '@/utils/format';
import { WATCH_FORMAT_VERSION, WATCH_ROUTINES_FORMAT, type WatchRoutinesDocument } from './format';

const clamp = (value: number, range: { min: number; max: number }) =>
  Number.isFinite(value) ? Math.min(range.max, Math.max(range.min, value)) : range.min;

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
    routines: routines.slice(0, IMPORT_LIMITS.routines).map((routine) => ({
      id: routine.id,
      name: routine.name,
      items: routine.items.slice(0, IMPORT_LIMITS.itemsPerRoutine).map((item) => ({
        id: item.id,
        exerciseId: item.exerciseId,
        exerciseName: item.exerciseName,
        sets: Math.round(clamp(item.sets, ITEM_BOUNDS.sets)),
        reps: item.reps.slice(0, ITEM_BOUNDS.repsLength),
        weightKg: clamp(item.weightKg, ITEM_BOUNDS.weightKg),
        restSeconds: Math.round(clamp(item.restSeconds, ITEM_BOUNDS.restSeconds)),
        notes: item.notes === null ? null : item.notes.slice(0, ITEM_BOUNDS.notesLength),
      })),
    })),
  };
}
