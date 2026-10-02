import { Layer } from 'effect';
import { CatalogRepositoryLive } from '@/features/exercises/data/repositories/catalogRepositoryLive';
import { ExerciseSnapshotRepositoryLive } from '@/features/exercises/data/repositories/exerciseSnapshotRepositoryLive';
import { BundledCatalogSourceLive } from '@/features/exercises/data/services/bundledCatalogSourceLive';
import { ExerciseCatalogLive } from '@/features/exercises/di/exerciseCatalogLive';

/**
 * Every Layer `exercises` provides: the catalog in SQLite, the bundled dataset it is installed
 * from, the stored snapshots, and the catalog as the features above use it.
 */
export const ExercisesLive = ExerciseCatalogLive.pipe(
  Layer.provideMerge(Layer.mergeAll(CatalogRepositoryLive, BundledCatalogSourceLive, ExerciseSnapshotRepositoryLive)),
);
