import { externalIdOf, isLocalExerciseId } from '@/features/exercises';
import type { ImportRules } from '@/features/transfer/domain/entities/ImportRules';
import { IMPORT_LIMITS, ITEM_BOUNDS } from '@/features/watch-bridge';

/**
 * The bounds the routine item editor's steppers use and the Apple Watch enforces: they live in
 * `features/watch-bridge/assets/bounds.json`, which the watch target ships a copy of. That file
 * holds no bound for the reps or the target RPE, so they are set here: the reps stepper stops at
 * 100, and RPE is the 0 to 10 scale.
 */
export const IMPORT_RULES: ImportRules = {
  limits: IMPORT_LIMITS,
  bounds: {
    sets: ITEM_BOUNDS.sets,
    reps: { min: 1, max: 100 },
    weightKg: ITEM_BOUNDS.weightKg,
    targetRpe: { min: 0, max: 10 },
    restSeconds: ITEM_BOUNDS.restSeconds,
    notesLength: ITEM_BOUNDS.notesLength,
  },
  isExerciseId: id => externalIdOf(id) !== null || isLocalExerciseId(id),
};
