import { isCatalogExerciseId, isLocalExerciseId } from '@/features/exercises';
import type { ImportRules } from '@/features/transfer/domain/entities/ImportRules';
import { IMPORT_LIMITS, ITEM_BOUNDS } from '@/features/watch-bridge';

/**
 * The bounds the routine item editor's steppers use and the Apple Watch enforces: they live in
 * `features/watch-bridge/assets/bounds.json`, which the watch target ships a copy of.
 */
export const IMPORT_RULES: ImportRules = {
  limits: IMPORT_LIMITS,
  bounds: {
    sets: ITEM_BOUNDS.sets,
    reps: ITEM_BOUNDS.reps,
    weightKg: ITEM_BOUNDS.weightKg,
    durationSeconds: ITEM_BOUNDS.durationSeconds,
    targetRpe: ITEM_BOUNDS.rpe,
    restSeconds: ITEM_BOUNDS.restSeconds,
    notesLength: ITEM_BOUNDS.notesLength,
  },
  isExerciseId: id => isCatalogExerciseId(id) || isLocalExerciseId(id),
};
