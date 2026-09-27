import { externalIdOf, isLocalExerciseId } from '@/features/exercises';
import type { ImportRules } from '@/features/transfer/domain/entities/ImportRules';
import { IMPORT_LIMITS, ITEM_BOUNDS } from '@/features/watch-bridge';

/**
 * The bounds the routine item editor's steppers use and the Apple Watch enforces: they live in
 * `features/watch-bridge/assets/bounds.json`, which the watch target ships a copy of.
 */
export const IMPORT_RULES: ImportRules = {
  limits: IMPORT_LIMITS,
  bounds: ITEM_BOUNDS,
  isExerciseId: id => externalIdOf(id) !== null || isLocalExerciseId(id),
};
