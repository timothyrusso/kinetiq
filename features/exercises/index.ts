import type { FeatureTier } from '@timothyrusso/arch-rules';

/** @public Read by the architecture rules, which build the tier graph from it. */
export const FEATURE_TIER: FeatureTier = 2;

export { ExercisesLive } from '@/features/exercises/di/layer';
export { CATALOG_PROVIDER } from '@/features/exercises/domain/entities/CatalogProvider';
/** The stored snapshots, which a routine writes before any of its items points at an exercise. */
export { ExerciseSnapshotRepository } from '@/features/exercises/domain/repositories/ExerciseSnapshotRepository';
export type { CatalogLanguage } from '@/features/exercises/domain/schemas/CatalogLanguage';
export type { Exercise } from '@/features/exercises/domain/schemas/ExerciseSchema';
export type { ExerciseSnapshot } from '@/features/exercises/domain/schemas/ExerciseSnapshotSchema';
/** What the sets of one exercise record; the schema decodes the stored literal. */
export { TrackingType } from '@/features/exercises/domain/schemas/TrackingType';
/** The catalog as the launch and the routine importer use it. */
export { ExerciseCatalog } from '@/features/exercises/domain/services/ExerciseCatalog';
/** The tracking type a newly added exercise starts with, in a routine or a live workout. */
export { defaultTrackingType } from '@/features/exercises/domain/utils/defaultTrackingType';
export { isCatalogExerciseId, isLocalExerciseId } from '@/features/exercises/domain/utils/exerciseId';
export { snapshotOf } from '@/features/exercises/domain/utils/snapshotOf';
export { useCatalogLanguage } from '@/features/exercises/facades/useCatalogLanguage';
export { useExercise } from '@/features/exercises/facades/useExercise';
/** The About block's content, which both exercise editors draw with the design system's `ExerciseAbout`. */
export { useExerciseAbout } from '@/features/exercises/facades/useExerciseAbout';
/** A stored image path as the bundled image it names, for the rows that draw an exercise. */
export { exerciseImageSource } from '@/features/exercises/mappers/exerciseImageSource';
export { snapshotInLanguage } from '@/features/exercises/mappers/snapshotInLanguage';
