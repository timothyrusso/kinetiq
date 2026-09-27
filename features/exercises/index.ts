import type { FeatureTier } from '@timothyrusso/arch-rules';

/** @public Read by the architecture rules, which build the tier graph from it. */
export const FEATURE_TIER: FeatureTier = 2;

export { ExercisesLive } from '@/features/exercises/di/layer';
export { CATALOG_PROVIDER } from '@/features/exercises/domain/entities/CatalogProvider';
/** The stored snapshots, which a routine writes before any of its items points at an exercise. */
export { ExerciseSnapshotRepository } from '@/features/exercises/domain/repositories/ExerciseSnapshotRepository';
export type { Exercise } from '@/features/exercises/domain/schemas/ExerciseSchema';
export type { ExerciseSnapshot } from '@/features/exercises/domain/schemas/ExerciseSnapshotSchema';
export { externalIdOf, isLocalExerciseId } from '@/features/exercises/domain/utils/exerciseId';
export { snapshotOf } from '@/features/exercises/domain/utils/snapshotOf';
export { useCatalogMeta } from '@/features/exercises/facades/useCatalogMeta';
export { useExercise } from '@/features/exercises/facades/useExercise';
export { useRefreshCatalog } from '@/features/exercises/facades/useRefreshCatalog';
/**
 * The use cases the legacy imperative callers (bootstrap, the routine importer) run through the
 * runtime, until #54 moves them into features.
 */
export { getExercise } from '@/features/exercises/useCases/getExercise';
export { installBundledCatalogIfMissing } from '@/features/exercises/useCases/installBundledCatalogIfMissing';
export { maybeRefreshCatalog } from '@/features/exercises/useCases/maybeRefreshCatalog';
export { searchExercises } from '@/features/exercises/useCases/searchExercises';
